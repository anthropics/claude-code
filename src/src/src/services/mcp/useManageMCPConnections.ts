import { feature } from 'bun:bundle'
import { basename } from 'path'
import { useCallback, useEffect, useRef } from 'react'
import { getSessionId } from '../../bootstrap/state.js'
import type { Command } from '../../commands.js'
import type { Tool } from '../../Tool.js'
import {
  clearServerCache,
  fetchCommandsForClient,
  fetchResourcesForClient,
  fetchToolsForClient,
  getMcpToolsCommandsAndResources,
  reconnectMcpServerImpl,
} from './client.js'
import type {
  MCPServerConnection,
  ScopedMcpServerConfig,
  ServerResource,
} from './types.js'

/* eslint-disable @typescript-eslint/no-require-imports */
const fetchMcpSkillsForClient = feature('MCP_SKILLS')
  ? (
      require('../../skills/mcpSkills.js') as typeof import('../../skills/mcpSkills.js')
    ).fetchMcpSkillsForClient
  : null
const clearSkillIndexCache = feature('EXPERIMENTAL_SKILL_SEARCH')
  ? (
      require('../skillSearch/localSearch.js') as typeof import('../skillSearch/localSearch.js')
    ).clearSkillIndexCache
  : null

import {
  PromptListChangedNotificationSchema,
  ResourceListChangedNotificationSchema,
  ToolListChangedNotificationSchema,
} from '@modelcontextprotocol/sdk/types.js'
import omit from 'lodash-es/omit.js'
import reject from 'lodash-es/reject.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from 'src/services/analytics/index.js'
import {
  dedupClaudeAiMcpServers,
  doesEnterpriseMcpConfigExist,
  filterMcpServersByPolicy,
  getClaudeCodeMcpConfigs,
  isMcpServerDisabled,
  setMcpServerEnabled,
} from 'src/services/mcp/config.js'
import type { AppState } from 'src/state/AppState.js'
import type { PluginError } from 'src/types/plugin.js'
import { logForDebugging } from 'src/utils/debug.js'
import { getAllowedChannels } from '../../bootstrap/state.js'
import { useNotifications } from '../../context/notifications.js'
import {
  useAppState,
  useAppStateStore,
  useSetAppState,
} from '../../state/AppState.js'
import { errorMessage } from '../../utils/errors.js'
/* eslint-enable @typescript-eslint/no-require-imports */
import { logMCPDebug, logMCPError } from '../../utils/log.js'
import { enqueue } from '../../utils/messageQueueManager.js'
import {
  CHANNEL_PERMISSION_METHOD,
  ChannelMessageNotificationSchema,
  ChannelPermissionNotificationSchema,
  findChannelEntry,
  gateChannelServer,
  wrapChannelMessage,
} from './channelNotification.js'
import {
  type ChannelPermissionCallbacks,
  createChannelPermissionCallbacks,
  isChannelPermissionRelayEnabled,
} from './channelPermissions.js'
import {
  clearClaudeAIMcpConfigsCache,
  fetchClaudeAIMcpConfigsIfEligible,
} from './claudeai.js'
import { registerElicitationHandler } from './elicitationHandler.js'
import { getMcpPrefix } from './mcpStringUtils.js'
import { commandBelongsToServer, excludeStalePluginClients } from './utils.js'

// Constants for reconnection with exponential backoff
const MAX_RECONNECT_ATTEMPTS = 5
const INITIAL_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 30000

/**
 * Create a unique key for a plugin error to enable deduplication
 */
function getErrorKey(error: PluginError): string {
  const plugin = 'plugin' in error ? error.plugin : 'no-plugin'
  return `${error.type}:${error.source}:${plugin}`
}

/**
 * Add errors to AppState, deduplicating to avoid showing the same error multiple times
 */
function addErrorsToAppState(
  setAppState: (updater: (prev: AppState) => AppState) => void,
  newErrors: PluginError[],
): void {
  if (newErrors.length === 0) return

  setAppState(prevState => {
    // Build set of existing error keys
    const existingKeys = new Set(
      prevState.plugins.errors.map(e => getErrorKey(e)),
    )

    // Only add errors that don't already exist
    const uniqueNewErrors = newErrors.filter(
      error => !existingKeys.has(getErrorKey(error)),
    )

    if (uniqueNewErrors.length === 0) {
      return prevState
    }

    return {
      ...prevState,
      plugins: {
        ...prevState.plugins,
        errors: [...prevState.plugins.errors, ...uniqueNewErrors],
      },
    }
  })
}

/**
 * Hook to manage MCP (Model Context Protocol) server connections and updates
 *
 * This hook:
 * 1. Initializes MCP client connections based on config
 * 2. Sets up handlers for connection lifecycle events and sync with app state
 * 3. Manages automatic reconnection for SSE connections
 * 4. Returns a reconnect function
 */
export function useManageMCPConnections(
  dynamicMcpConfig: Record<string, ScopedMcpServerConfig> | undefined,
  isStrictMcpConfig = false,
) {
  const store = useAppStateStore()
  const _authVersion = useAppState(s => s.authVersion)
  // Incremented by /reload-plugins (refreshActivePlugins) to pick up newly
  // enabled plugin MCP servers. getClaudeCodeMcpConfigs() reads loadAllPlugins()
  // which has been cleared by refreshActivePlugins, so the effects below see
  // fresh plugin data on re-run.
  const _pluginReconnectKey = useAppState(s => s.mcp.pluginReconnectKey)
  const setAppState = useSetAppState()

  // Track active reconnection attempts to allow cancellation
  const reconnectTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Dedup the --channels blocked warning per skip kind so that a user who
  // sees "run /login" (auth skip), logs in, then hits the policy gate
  // gets a second toast.
  const channelWarnedKindsRef = useRef<
    Set<'disabled' | 'auth' | 'policy' | 'marketplace' | 'allowlist'>
  >(new Set())
  // Channel permission callbacks — constructed once, stable ref. Stored in
  // AppState so interactiveHandler can subscribe. The pending Map lives inside
  // the closure (not module-level, not AppState — functions-in-state is brittle).
  const channelPermCallbacksRef = useRef<ChannelPermissionCallbacks | null>(
    null,
  )
  if (
    (feature('KAIROS') || feature('KAIROS_CHANNELS')) &&
    channelPermCallbacksRef.current === null
  ) {
    channelPermCallbacksRef.current = createChannelPermissionCallbacks()
  }
  // Store callbacks in AppState so interactiveHandler.ts can reach them via
  // ctx.toolUseContext.getAppState(). One-time set — the ref is stable.
  useEffect(() => {
    if (feature('KAIROS') || feature('KAIROS_CHANNELS')) {
      const callbacks = channelPermCallbacksRef.current
      if (!callbacks) return
      // GrowthBook runtime gate — separate from channels so channels can
      // ship without this. Checked at mount; mid-session flips need restart.
      // If off, callbacks never go into AppState → interactiveHandler sees
      // undefined → never sends → intercept has nothing pending → "yes tbxkq"
      // flows to Claude as normal chat. One gate, full disable.
      if (!isChannelPermissionRelayEnabled()) return
      setAppState(prev => {
        if (prev.channelPermissionCallbacks === callbacks) return prev
        return { ...prev, channelPermissionCallbacks: callbacks }
      })
      return () => {
        setAppState(prev => {
          if (prev.channelPermissionCallbacks === undefined) return prev
          return { ...prev, channelPermissionCallbacks: undefined }
        })
      }
    }
  }, [setAppState])
  const { addNotification } = useNotifications()

  // Batched MCP state updates: queue individual server updates and flush them
  // in a single setAppState call via setTimeout. Using a time-based window
  // (instead of queueMicrotask) ensures updates are batched even when
  // connection callbacks arrive at different times due to network I/O.
  const MCP_BATCH_FLUSH_MS = 16
  type PendingUpdate = MCPServerConnection & {
    tools?: Tool[]
    commands?: Command[]
    resources?: ServerResource[]
  }
  const pendingUpdatesRef = useRef<PendingUpdate[]>([])
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flushPendingUpdates = useCallback(() => {
    flushTimerRef.current = null
    const updates = pendingUpdatesRef.current
    if (updates.length === 0) return
    pendingUpdatesRef.current = []

    setAppState(prevState => {
      let mcp = prevState.mcp

      for (const update of updates) {
        const {
          tools: rawTools,
          commands: rawCmds,
          resources: rawRes,
          ...client
        } = update
        const tools =
          client.type === 'disabled' || client.type === 'failed'
            ? (rawTools ?? [])
            : rawTools
        const commands =
          client.type === 'disabled' || client.type === 'failed'
            ? (rawCmds ?? [])
            : rawCmds
        const resources =
          client.type === 'disabled' || client.type === 'failed'
            ? (rawRes ?? [])
            : rawRes

        const prefix = getMcpPrefix(client.name)
        const existingClientIndex = mcp.clients.findIndex(
          c => c.name === client.name,
        )

        const updatedClients =
          existingClientIndex === -1
            ? [...mcp.clients, client]
            : mcp.clients.map(c => (c.name === client.name ? client : c))

        const updatedTools =
          tools === undefined
            ? mcp.tools
            : [...reject(mcp.tools, t => t.name?.startsWith(prefix)), ...tools]

        const updatedCommands =
          commands === undefined
            ? mcp.commands
            : [
                ...reject(mcp.commands, c =>
                  commandBelongsToServer(c, client.name),
                ),
                ...commands,
              ]

        const updatedResources =
          resources === undefined
            ? mcp.resources
            : {
                ...mcp.resources,
                ...(resources.length > 0
                  ? { [client.name]: resources }
                  : omit(mcp.resources, client.name)),
              }

        mcp = {
          ...mcp,
          clients: updatedClients,
          tools: updatedTools,
          commands: updatedCommands,
          resources: updatedResources,
        }
      }

      return { ...prevState, mcp }
    })
  }, [setAppState])

  // Update server state, tools, commands, and resources.
  // When tools, commands, or resources are undefined, the existing values are preserved.
  // When type is 'disabled' or 'failed', tools/commands/resources are automatically cleared.
  // Updates are batched via setTimeout to coalesce updates arriving within MCP_BATCH_FLUSH_MS.
  const updateServer = useCallback(
    (update: PendingUpdate) => {
      pendingUpdatesRef.current.push(update)
      if (flushTimerRef.current === null) {
        flushTimerRef.current = setTimeout(
          flushPendingUpdates,
          MCP_BATCH_FLUSH_MS,
        )
      }
    },
    [flushPendingUpdates],
  )

  const onConnectionAttempt = useCallback(
    ({
      client,
      tools,
      commands,
      resources,
    }: {
      client: MCPServerConnection
      tools: Tool[]
      commands: Command[]
      resources?: ServerResource[]
    }) => {
      updateServer({ ...client, tools, commands, resources })

      // Handle side effects based on client state
      switch (client.type) {
        case 'connected': {
          // Overwrite the default elicitation handler registered in connectToServer
          // with the real one (queues elicitation in AppState for UI). Registering
          // here (once per connect) instead of in a [mcpClients] effect avoids
          // re-running for every already-connected server on each state change.
          registerElicitationHandler(client.client, client.name, setAppState)

          client.client.onclose = () => {
            const configType = client.config.type ?? 'stdio'

            clearServerCache(client.name, client.config).catch(() => {
              logForDebugging(
                `Failed to invalidate the server cache: ${client.name}`,
              )
            })

            // TODO: This really isn't great: ideally we'd check appstate as the source of truth
            // as to whether it was disconnected due to a disable, but appstate is stale at this
            // point. Getting a live reference to appstate feels a little hacky, so we'll just
            // check the disk state. We may want to refactor some of this.
            if (isMcpServerDisabled(client.name)) {
              logMCPDebug(
                client.name,
                `Server is disabled, skipping automatic reconnection`,
              )
              return
            }

            // Handle automatic reconnection for remote transports
            // Skip stdio (local process) and sdk (internal) - they don't support reconnection
            if (configType !== 'stdio' && configType !== 'sdk') {
              const transportType = getTransportDisplayName(configType)
              logMCPDebug(
                client.name,
                `${transportType} transport closed/disconnected, attempting automatic reconnection`,
              )

              // Cancel any existing reconnection attempt for this server
              const existingTimer = reconnectTimersRef.current.get(client.name)
              if (existingTimer) {
                clearTimeout(existingTimer)
                reconnectTimersRef.current.delete(client.name)
              }

              // Attempt reconnection with exponential backoff
              const reconnectWithBackoff = async () => {
                for (
                  let attempt = 1;
                  attempt <= MAX_RECONNECT_ATTEMPTS;
                  attempt++
                ) {
                  // Check if server was disabled while we were waiting
                  if (isMcpServerDisabled(client.name)) {
                    logMCPDebug(
                      client.name,
                      `Server disabled during reconnection, stopping retry`,
                    )
                    reconnectTimersRef.current.delete(client.name)
                    return
                  }

                  updateServer({
                    ...client,
                    type: 'pending',
                    reconnectAttempt: attempt,
                    maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
                  })

                  const reconnectStartTime = Date.now()
                  try {
                    const result = await reconnectMcpServerImpl(
                      client.name,
                      client.config,
                    )
                    const elapsed = Date.now() - reconnectStartTime

                    if (result.client.type === 'connected') {
                      logMCPDebug(
                        client.name,
                        `${transportType} reconnection successful after ${elapsed}ms (attempt ${attempt})`,
                      )
                      reconnectTimersRef.current.delete(client.name)
                      onConnectionAttempt(result)
                      return
                    }

                    logMCPDebug(
                      client.name,
                      `${transportType} reconnection attempt ${attempt} completed with status: ${result.client.type}`,
                    )

                    // On final attempt, update state with the result
                    if (attempt === MAX_RECONNECT_ATTEMPTS) {
                      logMCPDebug(
                        client.name,
                        `Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached, giving up`,
                      )
                      reconnectTimersRef.current.delete(client.name)
                      onConnectionAttempt(result)
                      return
                    }
                  } catch (error) {
                    const elapsed = Date.now() - reconnectStartTime
                    logMCPError(
                      client.name,
                      `${transportType} reconnection attempt ${attempt} failed after ${elapsed}ms: ${error}`,
                    )

                    // On final attempt, mark as failed
                    if (attempt === MAX_RECONNECT_ATTEMPTS) {
                      logMCPDebug(
                        client.name,
                        `Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached, giving up`,
                      )
                      reconnectTimersRef.current.delete(client.name)
                      updateServer({ ...client, type: 'failed' })
                      return
                    }
                  }

                  // Schedule next retry with exponential backoff
                  const backoffMs = Math.min(
                    INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1),
                    MAX_BACKOFF_MS,
                  )
                  logMCPDebug(
                    client.name,
                    `Scheduling reconnection attempt ${attempt + 1} in ${backoffMs}ms`,
                  )

                  await new Promise<void>(resolve => {
                    // eslint-disable-next-line no-restricted-syntax -- timer stored in ref for cancellation; sleep() doesn't expose the handle
                    const timer = setTimeout(resolve, backoffMs)
                    reconnectTimersRef.current.set(client.name, timer)
                  })
                }
              }

              void reconnectWithBackoff()
            } else {
              updateServer({ ...client, type: 'failed' })
            }
          }

          // Channel push: notifications/claude/channel → enqueue().
          // Gate decides whether to register the handler; connection stays
          // up either way (allowedMcpServers controls that).
          if (feature('KAIROS') || feature('KAIROS_CHANNELS')) {
            const gate = gateChannelServer(
              client.name,
              client.capabilities,
              client.config.pluginSource,
            )
            const entry = findChannelEntry(client.name, getAllowedChannels())
            // Plugin identifier for telemetry — log name@marketplace for any
            // plugin-kind entry (same tier as tengu_plugin_installed, which
            // logs arbitrary plugin_id+marketplace_name ungated). server-kind
            // names are MCP-server-name tier; those are opt-in-only elsewhere
            // (see isAnalyticsToolDetailsLoggingEnabled in metadata.ts) and
            // stay unlogged here. is_dev/entry_kind segment the rest.
            const pluginId =
              entry?.kind === 'plugin'
                ? (`${entry.name}@${entry.marketplace}` as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS)
                : undefined
            // Skip capability-miss — every non-channel MCP server trips it.
            if (gate.action === 'register' || gate.kind !== 'capability') {
              logEvent('tengu_mcp_channel_gate', {
                registered: gate.action === 'register',
                skip_kind:
                  gate.action === 'skip'
                    ? (gate.kind as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS)
                    : undefined,
                entry_kind:
                  entry?.kind as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
                is_dev: entry?.dev ?? false,
                plugin: pluginId,
              })
            }
            switch (gate.action) {
              case 'register':
                logMCPDebug(client.name, 'Channel notifications registered')
                client.client.setNotificationHandler(
                  ChannelMessageNotificationSchema(),
                  async notification => {
                    const { content, meta } = notification.params
                    logMCPDebug(
                      client.name,
                      `notifications/claude/channel: ${content.slice(0, 80)}`,
                    )
                    logEvent('tengu_mcp_channel_message', {
                      content_length: content.length,
                      meta_key_count: Object.keys(meta ?? {}).length,
                      entry_kind:
                        entry?.kind as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
                      is_dev: entry?.dev ?? false,
                      plugin: pluginId,
                    })
                    enqueue({
                      mode: 'prompt',
                      value: wrapChannelMessage(client.name, content, meta),
                      priority: 'next',
                      isMeta: true,
                      origin: { kind: 'channel', server: client.name },
                      skipSlashCommands: true,
                    })
                  },
                )
                // Permission-reply handler — separate event, separate
                // capability. Only registers if the server declares
                // claude/channel/permission (same opt-in check as the send
                // path in interactiveHandler.ts). Server parses the user's
                // reply and emits {request_id, behavior}; no regex on our
                // side, text in the general channel can't accidentally match.
                if (
                  client.capabilities?.experimental?.[
                    'claude/channel/permission'
                  ] !== undefined
                ) {
                  client.client.setNotificationHandler(
                    ChannelPermissionNotificationSchema(),
                    async notification => {
                      const { request_id, behavior } = notification.params
                      const resolved =
                        channelPermCallbacksRef.current?.resolve(
                          request_id,
                          behavior,
                          client.name,
                        ) ?? false
                      logMCPDebug(
                        client.name,
                        `notifications/claude/channel/permission: ${request_id} → ${behavior} (${resolved ? 'matched pending' : 'no pending entry — stale or unknown ID'})`,
                      )
                    },
                  )
                }
                break
              case 'skip':
                // Idempotent teardown so a register→skip re-gate (e.g.
                // effect re-runs after /logout) actually removes the live
                // handler. Without this, mid-session demotion is one-way:
                // the gate says skip but the earlier handler keeps enqueuing.
                // Map.delete — safe when never registered.
                client.client.removeNotificationHandler(
                  'notifications/claude/channel',
                )
                client.client.removeNotificationHandler(
                  CHANNEL_PERMISSION_METHOD,
                )
                logMCPDebug(
                  client.name,
                  `Channel notifications skipped: ${gate.reason}`,
                )
                // Surface a once-per-kind toast when a channel server is
                // blocked. This is the only
                // user-visible signal (logMCPDebug above requires --debug).
                // Capability/session skips are expected noise and stay
                // debug-only. marketplace/allowlist run after session — if
                // we're here with those kinds, the user asked for it.
                if (
                  gate.kind !== 'capability' &&
                  gate.kind !== 'session' &&
                  !channelWarnedKindsRef.current.has(gate.kind) &&
                  (gate.kind === 'marketplace' ||
                    gate.kind === 'allowlist' ||
                    entry !== undefined)
                ) {
                  channelWarnedKindsRef.current.add(gate.kind)
                  // disabled/auth/policy get custom toast copy (shorter, actionable);
                  // marketplace/allowlist reuse the gate's reason verbatim
                  // since it already names the mismatch.
                  const text =
                    gate.kind === 'disabled'
                      ? 'Channels are not currently available'
                      : gate.kind === 'auth'
                        ? 'Channels require claude.ai authentication · run /login'
                        : gate.kind === 'policy'
                          ? 'Channels are not enabled for your org · have an administrator set channelsEnabled: true in managed settings'
                          : gate.reason
                  addNotification({
                    key: `channels-blocked-${gate.kind}`,
                    priority: 'high',
                    text,
                    color: 'warning',
                    timeoutMs: 12000,
                  })
                }
                break
            }
          }

          // Register notification handlers for list_changed notifications
          // These allow the server to notify us when tools, prompts, or resources change
          if (client.capabilities?.tools?.listChanged) {
            client.client.setNotificationHandler(
              ToolListChangedNotificationSchema,
              async () => {
                logMCPDebug(
                  client.name,
                  `Received tools/list_changed notification, refreshing tools`,
                )
                try {
                  // Grab cached promise before invalidating to log previous count
                  const previousToolsPromise = fetchToolsForClient.cache.get(
                    client.name,
                  )
                  fetchToolsForClient.cache.delete(client.name)
                  const newTools = await fetchToolsForClient(client)
                  const newCount = newTools.length
                  if (previousToolsPromise) {
                    previousToolsPromise.then(
                      (previousTools: Tool[]) => {
                        logEvent('tengu_mcp_list_changed', {
                          type: 'tools' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
                          previousCount: previousTools.length,
                          newCount,
                        })
                      },
                      () => {
                        logEvent('tengu_mcp_list_changed', {
                          type: 'tools' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
                          newCount,
                        })
                      },
                    )
                  } else {
                    logEvent('tengu_mcp_list_changed', {
                      type: 'tools' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
                      newCount,
                    })
                  }
                  updateServer({ ...client, tools: newTools })
                } catch (error) {
                  logMCPError(
                    client.name,
                    `Failed to refresh tools after list_changed notification: ${errorMessage(error)}`,
                  )
                }
              },
            )
          }

          if (client.capabilities?.prompts?.listChanged) {
            client.client.setNotificationHandler(
              PromptListChangedNotificationSchema,
              async () => {
                logMCPDebug(
                  client.name,
                  `Received prompts/list_changed notification, refreshing prompts`,
                )
                logEvent('tengu_mcp_list_changed', {
                  type: 'prompts' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
                })
                try {
                  // Skills come from resources, not prompts — don't invalidate their
                  // cache here. fetchMcpSkillsForClient returns the cached result.
                  fetchCommandsForClient.cache.delete(client.name)
                  const [mcpPrompts, mcpSkills] = await Promise.all([
                    fetchCommandsForClient(client),
                    feature('MCP_SKILLS')
                      ? fetchMcpSkillsForClient!(client)
                      : Promise.resolve([]),
                  ])
                  updateServer({
                    ...client,
                    commands: [...mcpPrompts, ...mcpSkills],
                  })
                  // MCP skills changed — invalidate skill-search index so
                  // next discovery rebuilds with the new set.
                  clearSkillIndexCache?.()
                } catch (error) {
                  logMCPError(
                    client.name,
                    `Failed to refresh prompts after list_changed notification: ${errorMessage(error)}`,
                  )
                }
              },
            )
          }

          if (client.capabilities?.resources?.listChanged) {
            client.client.setNotificationHandler(
              ResourceListChangedNotificationSchema,
              async () => {
                logMCPDebug(
                  client.name,
                  `Received resources/list_changed notification, refreshing resources`,
                )
                logEvent('tengu_mcp_list_changed', {
                  type: 'resources' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
                })
                try {
                  fetchResourcesForClient.cache.delete(client.name)
                  if (feature('MCP_SKILLS')) {
                    // Skills are discovered from resources, so refresh them too.
                    // Invalidate prompts cache as well: we write commands here,
                    // and a concurrent prompts/list_changed could otherwise have
                    // us stomp its fresh result with our cached stale one.
                    fetchMcpSkillsForClient!.cache.delete(client.name)
                    fetchCommandsForClient.cache.delete(client.name)
                    const [newResources, mcpPrompts, mcpSkills] =
                      await Promise.all([
                        fetchResourcesForClient(client),
                        fetchCommandsForClient(client),
                        fetchMcpSkillsForClient!(client),
                      ])
                    updateServer({
                      ...client,
                      resources: newResources,
                      commands: [...mcpPrompts, ...mcpSkills],
                    })
                    // MCP skills changed — invalidate skill-search index so
                    // next discovery rebuilds with the new set.
                    clearSkillIndexCache?.()
                  } else {
                    const newResources = await fetchResourcesForClient(client)
                    updateServer({ ...client, resources: newResources })
                  }
                } catch (error) {
                  logMCPError(
                    client.name,
                    `Failed to refresh resources after list_changed notification: ${errorMessage(error)}`,
                  )
                }
              },
            )
          }
          break
        }

        case 'needs-auth':
        case 'failed':
        case 'pending':
        case 'disabled':
          break
      }
    },
    [updateServer],
  )

  // Initialize all servers to pending state if they don't exist in appState.
  // Re-runs on session change (/clear) and on /reload-plugins (pluginReconnectKey).
  // On plugin reload, also disconnects stale plugin MCP servers (scope 'dynamic')
  // that no longer appear in configs — prevents ghost tools from disabled plugins.
  // Skip claude.ai dedup here to avoid blocking on the network fetch; the connect
  // useEffect below runs immediately after and dedups before connecting.
  const sessionId = getSessionId()
  useEffect(() => {
    async function initializeServersAsPending() {
      const { servers: existingConfigs, errors: mcpErrors } = isStrictMcpConfig
        ? { servers: {}, errors: [] }
        : await getClaudeCodeMcpConfigs(dynamicMcpConfig)
      const configs = { ...existingConfigs, ...dynamicMcpConfig }

      // Add MCP errors to plugin errors for UI visibility (deduplicated)
      addErrorsToAppState(setAppState, mcpErrors)

      setAppState(prevState => {
        // Disconnect MCP servers that are stale: plugin servers removed from
        // config, or any server whose config hash changed (edited .mcp.json).
        // Stale servers get re-added as 'pending' below since their name is
        // now absent from mcpWithoutStale.clients.
        const { stale, ...mcpWithoutStale } = excludeStalePluginClients(
          prevState.mcp,
          configs,
        )
        // Clean up stale connections. Fire-and-forget — state updaters must
        // be synchronous. Three hazards to defuse before calling cleanup:
        //   1. Pending reconnect timer would fire with the OLD config.
        //   2. onclose (set at L254) starts reconnectWithBackoff with the
        //      OLD config from its closure — it checks isMcpServerDisabled
        //      but config-changed servers aren't disabled, so it'd race the
        //      fresh connection and last updateServer wins.
        //   3. clearServerCache internally calls connectToServer (memoized).
        //      For never-connected servers (disabled/pending/failed) the
        //      cache is empty → real connect attempt → spawn/OAuth just to
        //      immediately kill it. Only connected servers need cleanup.
        for (const s of stale) {
          const timer = reconnectTimersRef.current.get(s.name)
          if (timer) {
            clearTimeout(timer)
            reconnectTimersRef.current.delete(s.name)
          }
          if (s.type === 'connected') {
            s.client.onclose = undefined
            void clearServerCache(s.name, s.config).catch(() => {})
          }
        }

        const existingServerNames = new Set(
          mcpWithoutStale.clients.map(c => c.name),
        )
        const newClients = Object.entries(configs)
          .filter(([name]) => !existingServerNames.has(name))
          .map(([name, config]) => ({
            name,
            type: isMcpServerDisabled(name)
              ? ('disabled' as const)
              : ('pending' as const),
            config,
          }))

        if (newClients.length === 0 && stale.length === 0) {
          return prevState
        }

        return {
          ...prevState,
          mcp: {
            ...prevState.mcp,
            ...mcpWithoutStale,
            clients: [...mcpWithoutStale.clients, ...newClients],
          },
        }
      })
    }

    void initializeServersAsPending().catch(error => {
      logMCPError(
        'useManageMCPConnections',
        `Failed to initialize servers as pending: ${errorMessage(error)}`,
      )
    })
  }, [
    isStrictMcpConfig,
    dynamicMcpConfig,
    setAppState,
    sessionId,
    _pluginReconnectKey,
  ])

  // Load MCP configs and connect to servers
  // Two-phase loading: Claude Code configs first (fast), then claude.ai configs (may be slow)
  useEffect(() => {
    let cancelled = false

    async function loadAndConnectMcpConfigs() {
      // Clear claude.ai MCP cache so we fetch fresh configs with current auth
      // state. This is important when authVersion changes (e.g., after login/
      // logout). Kick off the fetch now so it overlaps with loadAllPlugins()
      // inside getClaudeCodeMcpConfigs; it's awaited only at the dedup step.
      // Phase 2 below awaits the same promise — no second network call.
      let claudeaiPromise: Promise<Record<string, ScopedMcpServerConfig>>
      if (isStrictMcpConfig || doesEnterpriseMcpConfigExist()) {
        claudeaiPromise = Promise.resolve({})
      } else {
        clearClaudeAIMcpConfigsCache()
        claudeaiPromise = fetchClaudeAIMcpConfigsIfEligible()
      }

      // Phase 1: Load Claude Code configs. Plugin MCP servers that duplicate a
      // --mcp-config entry or a claude.ai connector are suppressed here so they
      // don't connect alongside the connector in Phase 2.
      const { servers: claudeCodeConfigs, errors: mcpErrors } =
        isStrictMcpConfig
          ? { servers: {}, errors: [] }
          : await getClaudeCodeMcpConfigs(dynamicMcpConfig, claudeaiPromise)
      if (cancelled) return

      // Add MCP errors to plugin errors for UI visibility (deduplicated)
      addErrorsToAppState(setAppState, mcpErrors)

      const configs = { ...claudeCodeConfigs, ...dynamicMcpConfig }

      // Start connecting to Claude Code servers (don't wait - runs concurrently with Phase 2)
      // Filter out disabled servers to avoid unnecessary connection attempts
      const enabledConfigs = Object.fromEntries(
        Object.entries(configs).filter(([name]) => !isMcpServerDisabled(name)),
      )
      getMcpToolsCommandsAndResources(
        onConnectionAttempt,
        enabledConfigs,
      ).catch(error => {
        logMCPError(
          'useManageMcpConnections',
          `Failed to get MCP resources: ${errorMessage(error)}`,
        )
      })

      // Phase 2: Await claude.ai configs (started above; memoized — no second fetch)
      let claudeaiConfigs: Record<string, ScopedMcpServerConfig> = {}
      if (!isStrictMcpConfig) {
        claudeaiConfigs = filterMcpServersByPolicy(
          await claudeaiPromise,
        ).allowed
        if (cancelled) return

        // Suppress claude.ai connectors that duplicate an enabled manual server.
        // Keys never collide (`slack` vs `claude.ai Slack`) so the merge below
        // won't catch this — need content-based dedup by URL signature.
        if (Object.keys(claudeaiConfigs).length > 0) {
          const { servers: dedupedClaudeAi } = dedupClaudeAiMcpServers(
            claudeaiConfigs,
            configs,
          )
          claudeaiConfigs = dedupedClaudeAi
        }

        if (Object.keys(claudeaiConfigs).length > 0) {
          // Add claude.ai servers as pending immediately so they show up in UI
          setAppState(prevState => {
            const existingServerNames = new Set(
              prevState.mcp.clients.map(c => c.name),
            )
            const newClients = Object.entries(claudeaiConfigs)
              .filter(([name]) => !existingServerNames.has(name))
              .map(([name, config]) => ({
                name,
                type: isMcpServerDisabled(name)
                  ? ('disabled' as const)
                  : ('pending' as const),
                config,
              }))
            if (newClients.length === 0) return prevState
            return {
              ...prevState,
              mcp: {
                ...prevState.mcp,
                clients: [...prevState.mcp.clients, ...newClients],
              },
            }
          })

          // Now start connecting (only enabled servers)
          const enabledClaudeaiConfigs = Object.fromEntries(
            Object.entries(claudeaiConfigs).filter(
              ([name]) => !isMcpServerDisabled(name),
            ),
          )
          getMcpToolsCommandsAndResources(
            onConnectionAttempt,
            enabledClaudeaiConfigs,
          ).catch(error => {
            logMCPError(
              'useManageMcpConnections',
              `Failed to get claude.ai MCP resources: ${errorMessage(error)}`,
            )
          })
        }
      }

      // Log server counts after both phases complete
      const allConfigs = { ...configs, ...claudeaiConfigs }
      const counts = {
        enterprise: 0,
        global: 0,
        project: 0,
        user: 0,
        plugin: 0,
        claudeai: 0,
      }
      // Ant-only: collect stdio command basenames to correlate with RSS/FPS
      // metrics. Stdio servers like rust-analyzer can be heavy and we want to
      // know which ones correlate with poor session performance.
      const stdioCommands: string[] = []
      for (const [name, serverConfig] of Object.entries(allConfigs)) {
        if (serverConfig.scope === 'enterprise') counts.enterprise++
        else if (serverConfig.scope === 'user') counts.global++
        else if (serverConfig.scope === 'project') counts.project++
        else if (serverConfig.scope === 'local') counts.user++
        else if (serverConfig.scope === 'dynamic') counts.plugin++
        else if (serverConfig.scope === 'claudeai') counts.claudeai++

        if (
          process.env.USER_TYPE === 'ant' &&
          !isMcpServerDisabled(name) &&
          (serverConfig.type === undefined || serverConfig.type === 'stdio') &&
          'command' in serverConfig
        ) {
          stdioCommands.push(basename(serverConfig.command))
        }
      }
      logEvent('tengu_mcp_servers', {
        ...counts,
        ...(process.env.USER_TYPE === 'ant' && stdioCommands.length > 0
          ? {
              stdio_commands: stdioCommands
                .sort()
                .join(
                  ',',
                ) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
            }
          : {}),
      })
    }

    void loadAndConnectMcpConfigs()

    return () => {
      cancelled = true
    }
  }, [
    isStrictMcpConfig,
    dynamicMcpConfig,
    onConnectionAttempt,
    setAppState,
    _authVersion,
    sessionId,
    _pluginReconnectKey,
  ])

  // Cleanup all timers on unmount
  useEffect(() => {
    const timers = reconnectTimersRef.current
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer)
      }
      timers.clear()
      // Flush any pending batched MCP updates before unmount
      if (flushTimerRef.current !== null) {
        clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
        flushPendingUpdates()
      }
    }
  }, [flushPendingUpdates])

  // Expose reconnectMcpServer function for components to use.
  // Reads mcp.clients via store.getState() so this callback stays stable
  // across client state transitions (no need to re-create on every connect).
  const reconnectMcpServer = useCallback(
    async (serverName: string) => {
      const client = store
        .getState()
        .mcp.clients.find(c => c.name === serverName)
      if (!client) {
        throw new Error(`MCP server ${serverName} not found`)
      }

      // Cancel any pending automatic reconnection attempt
      const existingTimer = reconnectTimersRef.current.get(serverName)
      if (existingTimer) {
        clearTimeout(existingTimer)
        reconnectTimersRef.current.delete(serverName)
      }

      const result = await reconnectMcpServerImpl(serverName, client.config)

      onConnectionAttempt(result)

      // Don't throw, just let UI handle the client type in case the reconnect failed
      // (Detailed logs are within the reconnectMcpServerImpl via --debug)
      return result
    },
    [store, onConnectionAttempt],
  )

  // Expose function to toggle server enabled/disabled state
  const toggleMcpServer = useCallback(
    async (serverName: string): Promise<void> => {
      const client = store
        .getState()
        .mcp.clients.find(c => c.name === serverName)
      if (!client) {
        throw new Error(`MCP server ${serverName} not found`)
      }

      const isCurrentlyDisabled = client.type === 'disabled'

      if (!isCurrentlyDisabled) {
        // Cancel any pending automatic reconnection attempt
        const existingTimer = reconnectTimersRef.current.get(serverName)
        if (existingTimer) {
          clearTimeout(existingTimer)
          reconnectTimersRef.current.delete(serverName)
        }

        // Persist disabled state to disk FIRST before clearing cache
        // This is important because the onclose handler checks disk state
        setMcpServerEnabled(serverName, false)

        // Disabling: disconnect and clean up if currently connected
        if (client.type === 'connected') {
          await clearServerCache(serverName, client.config)
        }

        // Update to disabled state (tools/commands/resources auto-cleared)
        updateServer({
          name: serverName,
          type: 'disabled',
          config: client.config,
        })
      } else {
        // Enabling: persist enabled state to disk first
        setMcpServerEnabled(serverName, true)

        // Mark as pending and reconnect
        updateServer({
          name: serverName,
          type: 'pending',
          config: client.config,
        })

        // Reconnect the server
        const result = await reconnectMcpServerImpl(serverName, client.config)

        onConnectionAttempt(result)
      }
    },
    [store, updateServer, onConnectionAttempt],
  )

  return { reconnectMcpServer, toggleMcpServer }
}

function getTransportDisplayName(type: string): string {
  switch (type) {
    case 'http':
      return 'HTTP'
    case 'ws':
    case 'ws-ide':
      return 'WebSocket'
    default:
      return 'SSE'
  }
}
