import { feature } from 'bun:bundle';
import React, { useCallback, useEffect, useRef } from 'react';
import { setMainLoopModelOverride } from '../bootstrap/state.js';
import { type BridgePermissionCallbacks, type BridgePermissionResponse, isBridgePermissionResponse } from '../bridge/bridgePermissionCallbacks.js';
import { buildBridgeConnectUrl } from '../bridge/bridgeStatusUtil.js';
import { extractInboundMessageFields } from '../bridge/inboundMessages.js';
import type { BridgeState, ReplBridgeHandle } from '../bridge/replBridge.js';
import { setReplBridgeHandle } from '../bridge/replBridgeHandle.js';
import type { Command } from '../commands.js';
import { getSlashCommandToolSkills, isBridgeSafeCommand } from '../commands.js';
import { getRemoteSessionUrl } from '../constants/product.js';
import { useNotifications } from '../context/notifications.js';
import type { PermissionMode, SDKMessage } from '../entrypoints/agentSdkTypes.js';
import type { SDKControlResponse } from '../entrypoints/sdk/controlTypes.js';
import { Text } from '../ink.js';
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../services/analytics/growthbook.js';
import { useAppState, useAppStateStore, useSetAppState } from '../state/AppState.js';
import type { Message } from '../types/message.js';
import { getCwd } from '../utils/cwd.js';
import { logForDebugging } from '../utils/debug.js';
import { errorMessage } from '../utils/errors.js';
import { enqueue } from '../utils/messageQueueManager.js';
import { buildSystemInitMessage } from '../utils/messages/systemInit.js';
import { createBridgeStatusMessage, createSystemMessage } from '../utils/messages.js';
import { getAutoModeUnavailableNotification, getAutoModeUnavailableReason, isAutoModeGateEnabled, isBypassPermissionsModeDisabled, transitionPermissionMode } from '../utils/permissions/permissionSetup.js';
import { getLeaderToolUseConfirmQueue } from '../utils/swarm/leaderPermissionBridge.js';

/** How long after a failure before replBridgeEnabled is auto-cleared (stops retries). */
export const BRIDGE_FAILURE_DISMISS_MS = 10_000;

/**
 * Max consecutive initReplBridge failures before the hook stops re-attempting
 * for the session lifetime. Guards against paths that flip replBridgeEnabled
 * back on after auto-disable (settings sync, /remote-control, config tool)
 * when the underlying OAuth is unrecoverable — each re-attempt is another
 * guaranteed 401 against POST /v1/environments/bridge. Datadog 2026-03-08:
 * top stuck client generated 2,879 × 401/day alone (17% of all 401s on the
 * route).
 */
const MAX_CONSECUTIVE_INIT_FAILURES = 3;

/**
 * Hook that initializes an always-on bridge connection in the background
 * and writes new user/assistant messages to the bridge session.
 *
 * Silently skips if bridge is not enabled or user is not OAuth-authenticated.
 *
 * Watches AppState.replBridgeEnabled — when toggled off (via /config or footer),
 * the bridge is torn down. When toggled back on, it re-initializes.
 *
 * Inbound messages from claude.ai are injected into the REPL via queuedCommands.
 */
export function useReplBridge(messages: Message[], setMessages: (action: React.SetStateAction<Message[]>) => void, abortControllerRef: React.RefObject<AbortController | null>, commands: readonly Command[], mainLoopModel: string): {
  sendBridgeResult: () => void;
} {
  const handleRef = useRef<ReplBridgeHandle | null>(null);
  const teardownPromiseRef = useRef<Promise<void> | undefined>(undefined);
  const lastWrittenIndexRef = useRef(0);
  // Tracks UUIDs already flushed as initial messages. Persists across
  // bridge reconnections so Bridge #2+ only sends new messages — sending
  // duplicate UUIDs causes the server to kill the WebSocket.
  const flushedUUIDsRef = useRef(new Set<string>());
  const failureTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Persists across effect re-runs (unlike the effect's local state). Reset
  // only on successful init. Hits MAX_CONSECUTIVE_INIT_FAILURES → fuse blown
  // for the session, regardless of replBridgeEnabled re-toggling.
  const consecutiveFailuresRef = useRef(0);
  const setAppState = useSetAppState();
  const commandsRef = useRef(commands);
  commandsRef.current = commands;
  const mainLoopModelRef = useRef(mainLoopModel);
  mainLoopModelRef.current = mainLoopModel;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const store = useAppStateStore();
  const {
    addNotification
  } = useNotifications();
  const replBridgeEnabled = feature('BRIDGE_MODE') ?
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  useAppState(s => s.replBridgeEnabled) : false;
  const replBridgeConnected = feature('BRIDGE_MODE') ?
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  useAppState(s_0 => s_0.replBridgeConnected) : false;
  const replBridgeOutboundOnly = feature('BRIDGE_MODE') ?
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  useAppState(s_1 => s_1.replBridgeOutboundOnly) : false;
  const replBridgeInitialName = feature('BRIDGE_MODE') ?
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  useAppState(s_2 => s_2.replBridgeInitialName) : undefined;

  // Initialize/teardown bridge when enabled state changes.
  // Passes current messages as initialMessages so the remote session
  // starts with the existing conversation context (e.g. from /bridge).
  useEffect(() => {
    // feature() check must use positive pattern for dead code elimination —
    // negative pattern (if (!feature(...)) return) does NOT eliminate
    // dynamic imports below.
    if (feature('BRIDGE_MODE')) {
      if (!replBridgeEnabled) return;
      const outboundOnly = replBridgeOutboundOnly;
      function notifyBridgeFailed(detail?: string): void {
        if (outboundOnly) return;
        addNotification({
          key: 'bridge-failed',
          jsx: <>
              <Text color="error">Remote Control failed</Text>
              {detail && <Text dimColor> · {detail}</Text>}
            </>,
          priority: 'immediate'
        });
      }
      if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_INIT_FAILURES) {
        logForDebugging(`[bridge:repl] Hook: ${consecutiveFailuresRef.current} consecutive init failures, not retrying this session`);
        // Clear replBridgeEnabled so /remote-control doesn't mistakenly show
        // BridgeDisconnectDialog for a bridge that never connected.
        const fuseHint = 'disabled after repeated failures · restart to retry';
        notifyBridgeFailed(fuseHint);
        setAppState(prev => {
          if (prev.replBridgeError === fuseHint && !prev.replBridgeEnabled) return prev;
          return {
            ...prev,
            replBridgeError: fuseHint,
            replBridgeEnabled: false
          };
        });
        return;
      }
      let cancelled = false;
      // Capture messages.length now so we don't re-send initial messages
      // through writeMessages after the bridge connects.
      const initialMessageCount = messages.length;
      void (async () => {
        try {
          // Wait for any in-progress teardown to complete before registering
          // a new environment. Without this, the deregister HTTP call from
          // the previous teardown races with the new register call, and the
          // server may tear down the freshly-created environment.
          if (teardownPromiseRef.current) {
            logForDebugging('[bridge:repl] Hook: waiting for previous teardown to complete before re-init');
            await teardownPromiseRef.current;
            teardownPromiseRef.current = undefined;
            logForDebugging('[bridge:repl] Hook: previous teardown complete, proceeding with re-init');
          }
          if (cancelled) return;

          // Dynamic import so the module is tree-shaken in external builds
          const {
            initReplBridge
          } = await import('../bridge/initReplBridge.js');
          const {
            shouldShowAppUpgradeMessage
          } = await import('../bridge/envLessBridgeConfig.js');

          // Assistant mode: perpetual bridge session — claude.ai shows one
          // continuous conversation across CLI restarts instead of a new
          // session per invocation. initBridgeCore reads bridge-pointer.json
          // (the same crash-recovery file #20735 added) and reuses its
          // {environmentId, sessionId} via reuseEnvironmentId +
          // api.reconnectSession(). Teardown skips archive/deregister/
          // pointer-clear so the session survives clean exits, not just
          // crashes. Non-assistant bridges clear the pointer on teardown
          // (crash-recovery only).
          let perpetual = false;
          if (feature('KAIROS')) {
            const {
              isAssistantMode
            } = await import('../assistant/index.js');
            perpetual = isAssistantMode();
          }

          // When a user message arrives from claude.ai, inject it into the REPL.
          // Preserves the original UUID so that when the message is forwarded
          // back to CCR, it matches the original — avoiding duplicate messages.
          //
          // Async because file_attachments (if present) need a network fetch +
          // disk write before we enqueue with the @path prefix. Caller doesn't
          // await — messages with attachments just land in the queue slightly
          // later, which is fine (web messages aren't rapid-fire).
          async function handleInboundMessage(msg: SDKMessage): Promise<void> {
            try {
              const fields = extractInboundMessageFields(msg);
              if (!fields) return;
              const {
                uuid
              } = fields;

              // Dynamic import keeps the bridge code out of non-BRIDGE_MODE builds.
              const {
                resolveAndPrepend
              } = await import('../bridge/inboundAttachments.js');
              let sanitized = fields.content;
              if (feature('KAIROS_GITHUB_WEBHOOKS')) {
                /* eslint-disable @typescript-eslint/no-require-imports */
                const {
                  sanitizeInboundWebhookContent
                } = require('../bridge/webhookSanitizer.js') as typeof import('../bridge/webhookSanitizer.js');
                /* eslint-enable @typescript-eslint/no-require-imports */
                sanitized = sanitizeInboundWebhookContent(fields.content);
              }
              const content = await resolveAndPrepend(msg, sanitized);
              const preview = typeof content === 'string' ? content.slice(0, 80) : `[${content.length} content blocks]`;
              logForDebugging(`[bridge:repl] Injecting inbound user message: ${preview}${uuid ? ` uuid=${uuid}` : ''}`);
              enqueue({
                value: content,
                mode: 'prompt' as const,
                uuid,
                // skipSlashCommands stays true as defense-in-depth —
                // processUserInputBase overrides it internally when bridgeOrigin
                // is set AND the resolved command passes isBridgeSafeCommand.
                // This keeps exit-word suppression and immediate-command blocks
                // intact for any code path that checks skipSlashCommands directly.
                skipSlashCommands: true,
                bridgeOrigin: true
              });
            } catch (e) {
              logForDebugging(`[bridge:repl] handleInboundMessage failed: ${e}`, {
                level: 'error'
              });
            }
          }

          // State change callback — maps bridge lifecycle events to AppState.
          function handleStateChange(state: BridgeState, detail_0?: string): void {
            if (cancelled) return;
            if (outboundOnly) {
              logForDebugging(`[bridge:repl] Mirror state=${state}${detail_0 ? ` detail=${detail_0}` : ''}`);
              // Sync replBridgeConnected so the forwarding effect starts/stops
              // writing as the transport comes up or dies.
              if (state === 'failed') {
                setAppState(prev_3 => {
                  if (!prev_3.replBridgeConnected) return prev_3;
                  return {
                    ...prev_3,
                    replBridgeConnected: false
                  };
                });
              } else if (state === 'ready' || state === 'connected') {
                setAppState(prev_4 => {
                  if (prev_4.replBridgeConnected) return prev_4;
                  return {
                    ...prev_4,
                    replBridgeConnected: true
                  };
                });
              }
              return;
            }
            const handle = handleRef.current;
            switch (state) {
              case 'ready':
                setAppState(prev_9 => {
                  const connectUrl = handle && handle.environmentId !== '' ? buildBridgeConnectUrl(handle.environmentId, handle.sessionIngressUrl) : prev_9.replBridgeConnectUrl;
                  const sessionUrl = handle ? getRemoteSessionUrl(handle.bridgeSessionId, handle.sessionIngressUrl) : prev_9.replBridgeSessionUrl;
                  const envId = handle?.environmentId;
                  const sessionId = handle?.bridgeSessionId;
                  if (prev_9.replBridgeConnected && !prev_9.replBridgeSessionActive && !prev_9.replBridgeReconnecting && prev_9.replBridgeConnectUrl === connectUrl && prev_9.replBridgeSessionUrl === sessionUrl && prev_9.replBridgeEnvironmentId === envId && prev_9.replBridgeSessionId === sessionId) {
                    return prev_9;
                  }
                  return {
                    ...prev_9,
                    replBridgeConnected: true,
                    replBridgeSessionActive: false,
                    replBridgeReconnecting: false,
                    replBridgeConnectUrl: connectUrl,
                    replBridgeSessionUrl: sessionUrl,
                    replBridgeEnvironmentId: envId,
                    replBridgeSessionId: sessionId,
                    replBridgeError: undefined
                  };
                });
                break;
              case 'connected':
                {
                  setAppState(prev_8 => {
                    if (prev_8.replBridgeSessionActive) return prev_8;
                    return {
                      ...prev_8,
                      replBridgeConnected: true,
                      replBridgeSessionActive: true,
                      replBridgeReconnecting: false,
                      replBridgeError: undefined
                    };
                  });
                  // Send system/init so remote clients (web/iOS/Android) get
                  // session metadata. REPL uses query() directly — never hits
                  // QueryEngine's SDKMessage layer — so this is the only path
                  // to put system/init on the REPL-bridge wire. Skills load is
                  // async (memoized, cheap after REPL startup); fire-and-forget
                  // so the connected-state transition isn't blocked.
                  if (getFeatureValue_CACHED_MAY_BE_STALE('tengu_bridge_system_init', false)) {
                    void (async () => {
                      try {
                        const skills = await getSlashCommandToolSkills(getCwd());
                        if (cancelled) return;
                        const state_0 = store.getState();
                        handleRef.current?.writeSdkMessages([buildSystemInitMessage({
                          // tools/mcpClients/plugins redacted for REPL-bridge:
                          // MCP-prefixed tool names and server names leak which
                          // integrations the user has wired up; plugin paths leak
                          // raw filesystem paths (username, project structure).
                          // CCR v2 persists SDK messages to Spanner — users who
                          // tap "Connect from phone" may not expect these on
                          // Anthropic's servers. QueryEngine (SDK) still emits
                          // full lists — SDK consumers expect full telemetry.
                          tools: [],
                          mcpClients: [],
                          model: mainLoopModelRef.current,
                          permissionMode: state_0.toolPermissionContext.mode as PermissionMode,
                          // TODO: avoid the cast
                          // Remote clients can only invoke bridge-safe commands —
                          // advertising unsafe ones (local-jsx, unallowed local)
                          // would let mobile/web attempt them and hit errors.
                          commands: commandsRef.current.filter(isBridgeSafeCommand),
                          agents: state_0.agentDefinitions.activeAgents,
                          skills,
                          plugins: [],
                          fastMode: state_0.fastMode
                        })]);
                      } catch (err_0) {
                        logForDebugging(`[bridge:repl] Failed to send system/init: ${errorMessage(err_0)}`, {
                          level: 'error'
                        });
                      }
                    })();
                  }
                  break;
                }
              case 'reconnecting':
                setAppState(prev_7 => {
                  if (prev_7.replBridgeReconnecting) return prev_7;
                  return {
                    ...prev_7,
                    replBridgeReconnecting: true,
                    replBridgeSessionActive: false
                  };
                });
                break;
              case 'failed':
                // Clear any previous failure dismiss timer
                clearTimeout(failureTimeoutRef.current);
                notifyBridgeFailed(detail_0);
                setAppState(prev_5 => ({
                  ...prev_5,
                  replBridgeError: detail_0,
                  replBridgeReconnecting: false,
                  replBridgeSessionActive: false,
                  replBridgeConnected: false
                }));
                // Auto-disable after timeout so the hook stops retrying.
                failureTimeoutRef.current = setTimeout(() => {
                  if (cancelled) return;
                  failureTimeoutRef.current = undefined;
                  setAppState(prev_6 => {
                    if (!prev_6.replBridgeError) return prev_6;
                    return {
                      ...prev_6,
                      replBridgeEnabled: false,
                      replBridgeError: undefined
                    };
                  });
                }, BRIDGE_FAILURE_DISMISS_MS);
                break;
            }
          }

          // Map of pending bridge permission response handlers, keyed by request_id.
          // Each entry is an onResponse handler waiting for CCR to reply.
          const pendingPermissionHandlers = new Map<string, (response: BridgePermissionResponse) => void>();

          // Dispatch incoming control_response messages to registered handlers
          function handlePermissionResponse(msg_0: SDKControlResponse): void {
            const requestId = msg_0.response?.request_id;
            if (!requestId) return;
            const handler = pendingPermissionHandlers.get(requestId);
            if (!handler) {
              logForDebugging(`[bridge:repl] No handler for control_response request_id=${requestId}`);
              return;
            }
            pendingPermissionHandlers.delete(requestId);
            // Extract the permission decision from the control_response payload
            const inner = msg_0.response;
            if (inner.subtype === 'success' && inner.response && isBridgePermissionResponse(inner.response)) {
              handler(inner.response);
            }
          }
          const handle_0 = await initReplBridge({
            outboundOnly,
            tags: outboundOnly ? ['ccr-mirror'] : undefined,
            onInboundMessage: handleInboundMessage,
            onPermissionResponse: handlePermissionResponse,
            onInterrupt() {
              abortControllerRef.current?.abort();
            },
            onSetModel(model) {
              const resolved = model === 'default' ? null : model ?? null;
              setMainLoopModelOverride(resolved);
              setAppState(prev_10 => {
                if (prev_10.mainLoopModelForSession === resolved) return prev_10;
                return {
                  ...prev_10,
                  mainLoopModelForSession: resolved
                };
              });
            },
            onSetMaxThinkingTokens(maxTokens) {
              const enabled = maxTokens !== null;
              setAppState(prev_11 => {
                if (prev_11.thinkingEnabled === enabled) return prev_11;
                return {
                  ...prev_11,
                  thinkingEnabled: enabled
                };
              });
            },
            onSetPermissionMode(mode) {
              // Policy guards MUST fire before transitionPermissionMode —
              // its internal auto-gate check is a defensive throw (with a
              // setAutoModeActive(true) side-effect BEFORE the throw) rather
              // than a graceful reject. Letting that throw escape would:
              // (1) leave STATE.autoModeActive=true while the mode is
              //     unchanged (3-way invariant violation per src/CLAUDE.md)
              // (2) fail to send a control_response → server kills WS
              // These mirror print.ts handleSetPermissionMode; the bridge
              // can't import the checks directly (bootstrap-isolation), so
              // it relies on this verdict to emit the error response.
              if (mode === 'bypassPermissions') {
                if (isBypassPermissionsModeDisabled()) {
                  return {
                    ok: false,
                    error: 'Cannot set permission mode to bypassPermissions because it is disabled by settings or configuration'
                  };
                }
                if (!store.getState().toolPermissionContext.isBypassPermissionsModeAvailable) {
                  return {
                    ok: false,
                    error: 'Cannot set permission mode to bypassPermissions because the session was not launched with --dangerously-skip-permissions'
                  };
                }
              }
              if (feature('TRANSCRIPT_CLASSIFIER') && mode === 'auto' && !isAutoModeGateEnabled()) {
                const reason = getAutoModeUnavailableReason();
                return {
                  ok: false,
                  error: reason ? `Cannot set permission mode to auto: ${getAutoModeUnavailableNotification(reason)}` : 'Cannot set permission mode to auto'
                };
              }
              // Guards passed — apply via the centralized transition so
              // prePlanMode stashing and auto-mode state sync all fire.
              setAppState(prev_12 => {
                const current = prev_12.toolPermissionContext.mode;
                if (current === mode) return prev_12;
                const next = transitionPermissionMode(current, mode, prev_12.toolPermissionContext);
                return {
                  ...prev_12,
                  toolPermissionContext: {
                    ...next,
                    mode
                  }
                };
              });
              // Recheck queued permission prompts now that mode changed.
              setImmediate(() => {
                getLeaderToolUseConfirmQueue()?.(currentQueue => {
                  currentQueue.forEach(item => {
                    void item.recheckPermission();
                  });
                  return currentQueue;
                });
              });
              return {
                ok: true
              };
            },
            onStateChange: handleStateChange,
            initialMessages: messages.length > 0 ? messages : undefined,
            getMessages: () => messagesRef.current,
            previouslyFlushedUUIDs: flushedUUIDsRef.current,
            initialName: replBridgeInitialName,
            perpetual
          });
          if (cancelled) {
            // Effect was cancelled while initReplBridge was in flight.
            // Tear down the handle to avoid leaking resources (poll loop,
            // WebSocket, registered environment, cleanup callback).
            logForDebugging(`[bridge:repl] Hook: init cancelled during flight, tearing down${handle_0 ? ` env=${handle_0.environmentId}` : ''}`);
            if (handle_0) {
              void handle_0.teardown();
            }
            return;
          }
          if (!handle_0) {
            // initReplBridge returned null — a precondition failed. For most
            // cases (no_oauth, policy_denied, etc.) onStateChange('failed')
            // already fired with a specific hint. The GrowthBook-gate-off case
            // is intentionally silent — not a failure, just not rolled out.
            consecutiveFailuresRef.current++;
            logForDebugging(`[bridge:repl] Init returned null (precondition or session creation failed); consecutive failures: ${consecutiveFailuresRef.current}`);
            clearTimeout(failureTimeoutRef.current);
            setAppState(prev_13 => ({
              ...prev_13,
              replBridgeError: prev_13.replBridgeError ?? 'check debug logs for details'
            }));
            failureTimeoutRef.current = setTimeout(() => {
              if (cancelled) return;
              failureTimeoutRef.current = undefined;
              setAppState(prev_14 => {
                if (!prev_14.replBridgeError) return prev_14;
                return {
                  ...prev_14,
                  replBridgeEnabled: false,
                  replBridgeError: undefined
                };
              });
            }, BRIDGE_FAILURE_DISMISS_MS);
            return;
          }
          handleRef.current = handle_0;
          setReplBridgeHandle(handle_0);
          consecutiveFailuresRef.current = 0;
          // Skip initial messages in the forwarding effect — they were
          // already loaded as session events during creation.
          lastWrittenIndexRef.current = initialMessageCount;
          if (outboundOnly) {
            setAppState(prev_15 => {
              if (prev_15.replBridgeConnected && prev_15.replBridgeSessionId === handle_0.bridgeSessionId) return prev_15;
              return {
                ...prev_15,
                replBridgeConnected: true,
                replBridgeSessionId: handle_0.bridgeSessionId,
                replBridgeSessionUrl: undefined,
                replBridgeConnectUrl: undefined,
                replBridgeError: undefined
              };
            });
            logForDebugging(`[bridge:repl] Mirror initialized, session=${handle_0.bridgeSessionId}`);
          } else {
            // Build bridge permission callbacks so the interactive permission
            // handler can race bridge responses against local user interaction.
            const permissionCallbacks: BridgePermissionCallbacks = {
              sendRequest(requestId_0, toolName, input, toolUseId, description, permissionSuggestions, blockedPath) {
                handle_0.sendControlRequest({
                  type: 'control_request',
                  request_id: requestId_0,
                  request: {
                    subtype: 'can_use_tool',
                    tool_name: toolName,
                    input,
                    tool_use_id: toolUseId,
                    description,
                    ...(permissionSuggestions ? {
                      permission_suggestions: permissionSuggestions
                    } : {}),
                    ...(blockedPath ? {
                      blocked_path: blockedPath
                    } : {})
                  }
                });
              },
              sendResponse(requestId_1, response) {
                const payload: Record<string, unknown> = {
                  ...response
                };
                handle_0.sendControlResponse({
                  type: 'control_response',
                  response: {
                    subtype: 'success',
                    request_id: requestId_1,
                    response: payload
                  }
                });
              },
              cancelRequest(requestId_2) {
                handle_0.sendControlCancelRequest(requestId_2);
              },
              onResponse(requestId_3, handler_0) {
                pendingPermissionHandlers.set(requestId_3, handler_0);
                return () => {
                  pendingPermissionHandlers.delete(requestId_3);
                };
              }
            };
            setAppState(prev_16 => ({
              ...prev_16,
              replBridgePermissionCallbacks: permissionCallbacks
            }));
            const url = getRemoteSessionUrl(handle_0.bridgeSessionId, handle_0.sessionIngressUrl);
            // environmentId === '' signals the v2 env-less path. buildBridgeConnectUrl
            // builds an env-specific connect URL, which doesn't exist without an env.
            const hasEnv = handle_0.environmentId !== '';
            const connectUrl_0 = hasEnv ? buildBridgeConnectUrl(handle_0.environmentId, handle_0.sessionIngressUrl) : undefined;
            setAppState(prev_17 => {
              if (prev_17.replBridgeConnected && prev_17.replBridgeSessionUrl === url) {
                return prev_17;
              }
              return {
                ...prev_17,
                replBridgeConnected: true,
                replBridgeSessionUrl: url,
                replBridgeConnectUrl: connectUrl_0 ?? prev_17.replBridgeConnectUrl,
                replBridgeEnvironmentId: handle_0.environmentId,
                replBridgeSessionId: handle_0.bridgeSessionId,
                replBridgeError: undefined
              };
            });

            // Show bridge status with URL in the transcript. perpetual (KAIROS
            // assistant mode) falls back to v1 at initReplBridge.ts — skip the
            // v2-only upgrade nudge for them. Own try/catch so a cosmetic
            // GrowthBook hiccup doesn't hit the outer init-failure handler.
            const upgradeNudge = !perpetual ? await shouldShowAppUpgradeMessage().catch(() => false) : false;
            if (cancelled) return;
            setMessages(prev_18 => [...prev_18, createBridgeStatusMessage(url, upgradeNudge ? 'Please upgrade to the latest version of the Claude mobile app to see your Remote Control sessions.' : undefined)]);
            logForDebugging(`[bridge:repl] Hook initialized, session=${handle_0.bridgeSessionId}`);
          }
        } catch (err) {
          // Never crash the REPL — surface the error in the UI.
          // Check cancelled first (symmetry with the !handle path at line ~386):
          // if initReplBridge threw during rapid toggle-off (in-flight network
          // error), don't count that toward the fuse or spam a stale error
          // into the UI. Also fixes pre-existing spurious setAppState/
          // setMessages on cancelled throws.
          if (cancelled) return;
          consecutiveFailuresRef.current++;
          const errMsg = errorMessage(err);
          logForDebugging(`[bridge:repl] Init failed: ${errMsg}; consecutive failures: ${consecutiveFailuresRef.current}`);
          clearTimeout(failureTimeoutRef.current);
          notifyBridgeFailed(errMsg);
          setAppState(prev_0 => ({
            ...prev_0,
            replBridgeError: errMsg
          }));
          failureTimeoutRef.current = setTimeout(() => {
            if (cancelled) return;
            failureTimeoutRef.current = undefined;
            setAppState(prev_1 => {
              if (!prev_1.replBridgeError) return prev_1;
              return {
                ...prev_1,
                replBridgeEnabled: false,
                replBridgeError: undefined
              };
            });
          }, BRIDGE_FAILURE_DISMISS_MS);
          if (!outboundOnly) {
            setMessages(prev_2 => [...prev_2, createSystemMessage(`Remote Control failed to connect: ${errMsg}`, 'warning')]);
          }
        }
      })();
      return () => {
        cancelled = true;
        clearTimeout(failureTimeoutRef.current);
        failureTimeoutRef.current = undefined;
        if (handleRef.current) {
          logForDebugging(`[bridge:repl] Hook cleanup: starting teardown for env=${handleRef.current.environmentId} session=${handleRef.current.bridgeSessionId}`);
          teardownPromiseRef.current = handleRef.current.teardown();
          handleRef.current = null;
          setReplBridgeHandle(null);
        }
        setAppState(prev_19 => {
          if (!prev_19.replBridgeConnected && !prev_19.replBridgeSessionActive && !prev_19.replBridgeError) {
            return prev_19;
          }
          return {
            ...prev_19,
            replBridgeConnected: false,
            replBridgeSessionActive: false,
            replBridgeReconnecting: false,
            replBridgeConnectUrl: undefined,
            replBridgeSessionUrl: undefined,
            replBridgeEnvironmentId: undefined,
            replBridgeSessionId: undefined,
            replBridgeError: undefined,
            replBridgePermissionCallbacks: undefined
          };
        });
        lastWrittenIndexRef.current = 0;
      };
    }
  }, [replBridgeEnabled, replBridgeOutboundOnly, setAppState, setMessages, addNotification]);

  // Write new messages as they appear.
  // Also re-runs when replBridgeConnected changes (bridge finishes init),
  // so any messages that arrived before the bridge was ready get written.
  useEffect(() => {
    // Positive feature() guard — see first useEffect comment
    if (feature('BRIDGE_MODE')) {
      if (!replBridgeConnected) return;
      const handle_1 = handleRef.current;
      if (!handle_1) return;

      // Clamp the index in case messages were compacted (array shortened).
      // After compaction the ref could exceed messages.length, and without
      // clamping no new messages would be forwarded.
      if (lastWrittenIndexRef.current > messages.length) {
        logForDebugging(`[bridge:repl] Compaction detected: lastWrittenIndex=${lastWrittenIndexRef.current} > messages.length=${messages.length}, clamping`);
      }
      const startIndex = Math.min(lastWrittenIndexRef.current, messages.length);

      // Collect new messages since last write
      const newMessages: Message[] = [];
      for (let i = startIndex; i < messages.length; i++) {
        const msg_1 = messages[i];
        if (msg_1 && (msg_1.type === 'user' || msg_1.type === 'assistant' || msg_1.type === 'system' && msg_1.subtype === 'local_command')) {
          newMessages.push(msg_1);
        }
      }
      lastWrittenIndexRef.current = messages.length;
      if (newMessages.length > 0) {
        handle_1.writeMessages(newMessages);
      }
    }
  }, [messages, replBridgeConnected]);
  const sendBridgeResult = useCallback(() => {
    if (feature('BRIDGE_MODE')) {
      handleRef.current?.sendResult();
    }
  }, []);
  return {
    sendBridgeResult
  };
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmZWF0dXJlIiwiUmVhY3QiLCJ1c2VDYWxsYmFjayIsInVzZUVmZmVjdCIsInVzZVJlZiIsInNldE1haW5Mb29wTW9kZWxPdmVycmlkZSIsIkJyaWRnZVBlcm1pc3Npb25DYWxsYmFja3MiLCJCcmlkZ2VQZXJtaXNzaW9uUmVzcG9uc2UiLCJpc0JyaWRnZVBlcm1pc3Npb25SZXNwb25zZSIsImJ1aWxkQnJpZGdlQ29ubmVjdFVybCIsImV4dHJhY3RJbmJvdW5kTWVzc2FnZUZpZWxkcyIsIkJyaWRnZVN0YXRlIiwiUmVwbEJyaWRnZUhhbmRsZSIsInNldFJlcGxCcmlkZ2VIYW5kbGUiLCJDb21tYW5kIiwiZ2V0U2xhc2hDb21tYW5kVG9vbFNraWxscyIsImlzQnJpZGdlU2FmZUNvbW1hbmQiLCJnZXRSZW1vdGVTZXNzaW9uVXJsIiwidXNlTm90aWZpY2F0aW9ucyIsIlBlcm1pc3Npb25Nb2RlIiwiU0RLTWVzc2FnZSIsIlNES0NvbnRyb2xSZXNwb25zZSIsIlRleHQiLCJnZXRGZWF0dXJlVmFsdWVfQ0FDSEVEX01BWV9CRV9TVEFMRSIsInVzZUFwcFN0YXRlIiwidXNlQXBwU3RhdGVTdG9yZSIsInVzZVNldEFwcFN0YXRlIiwiTWVzc2FnZSIsImdldEN3ZCIsImxvZ0ZvckRlYnVnZ2luZyIsImVycm9yTWVzc2FnZSIsImVucXVldWUiLCJidWlsZFN5c3RlbUluaXRNZXNzYWdlIiwiY3JlYXRlQnJpZGdlU3RhdHVzTWVzc2FnZSIsImNyZWF0ZVN5c3RlbU1lc3NhZ2UiLCJnZXRBdXRvTW9kZVVuYXZhaWxhYmxlTm90aWZpY2F0aW9uIiwiZ2V0QXV0b01vZGVVbmF2YWlsYWJsZVJlYXNvbiIsImlzQXV0b01vZGVHYXRlRW5hYmxlZCIsImlzQnlwYXNzUGVybWlzc2lvbnNNb2RlRGlzYWJsZWQiLCJ0cmFuc2l0aW9uUGVybWlzc2lvbk1vZGUiLCJnZXRMZWFkZXJUb29sVXNlQ29uZmlybVF1ZXVlIiwiQlJJREdFX0ZBSUxVUkVfRElTTUlTU19NUyIsIk1BWF9DT05TRUNVVElWRV9JTklUX0ZBSUxVUkVTIiwidXNlUmVwbEJyaWRnZSIsIm1lc3NhZ2VzIiwic2V0TWVzc2FnZXMiLCJhY3Rpb24iLCJTZXRTdGF0ZUFjdGlvbiIsImFib3J0Q29udHJvbGxlclJlZiIsIlJlZk9iamVjdCIsIkFib3J0Q29udHJvbGxlciIsImNvbW1hbmRzIiwibWFpbkxvb3BNb2RlbCIsInNlbmRCcmlkZ2VSZXN1bHQiLCJoYW5kbGVSZWYiLCJ0ZWFyZG93blByb21pc2VSZWYiLCJQcm9taXNlIiwidW5kZWZpbmVkIiwibGFzdFdyaXR0ZW5JbmRleFJlZiIsImZsdXNoZWRVVUlEc1JlZiIsIlNldCIsImZhaWx1cmVUaW1lb3V0UmVmIiwiUmV0dXJuVHlwZSIsInNldFRpbWVvdXQiLCJjb25zZWN1dGl2ZUZhaWx1cmVzUmVmIiwic2V0QXBwU3RhdGUiLCJjb21tYW5kc1JlZiIsImN1cnJlbnQiLCJtYWluTG9vcE1vZGVsUmVmIiwibWVzc2FnZXNSZWYiLCJzdG9yZSIsImFkZE5vdGlmaWNhdGlvbiIsInJlcGxCcmlkZ2VFbmFibGVkIiwicyIsInJlcGxCcmlkZ2VDb25uZWN0ZWQiLCJyZXBsQnJpZGdlT3V0Ym91bmRPbmx5IiwicmVwbEJyaWRnZUluaXRpYWxOYW1lIiwib3V0Ym91bmRPbmx5Iiwibm90aWZ5QnJpZGdlRmFpbGVkIiwiZGV0YWlsIiwia2V5IiwianN4IiwicHJpb3JpdHkiLCJmdXNlSGludCIsInByZXYiLCJyZXBsQnJpZGdlRXJyb3IiLCJjYW5jZWxsZWQiLCJpbml0aWFsTWVzc2FnZUNvdW50IiwibGVuZ3RoIiwiaW5pdFJlcGxCcmlkZ2UiLCJzaG91bGRTaG93QXBwVXBncmFkZU1lc3NhZ2UiLCJwZXJwZXR1YWwiLCJpc0Fzc2lzdGFudE1vZGUiLCJoYW5kbGVJbmJvdW5kTWVzc2FnZSIsIm1zZyIsImZpZWxkcyIsInV1aWQiLCJyZXNvbHZlQW5kUHJlcGVuZCIsInNhbml0aXplZCIsImNvbnRlbnQiLCJzYW5pdGl6ZUluYm91bmRXZWJob29rQ29udGVudCIsInJlcXVpcmUiLCJwcmV2aWV3Iiwic2xpY2UiLCJ2YWx1ZSIsIm1vZGUiLCJjb25zdCIsInNraXBTbGFzaENvbW1hbmRzIiwiYnJpZGdlT3JpZ2luIiwiZSIsImxldmVsIiwiaGFuZGxlU3RhdGVDaGFuZ2UiLCJzdGF0ZSIsImhhbmRsZSIsImNvbm5lY3RVcmwiLCJlbnZpcm9ubWVudElkIiwic2Vzc2lvbkluZ3Jlc3NVcmwiLCJyZXBsQnJpZGdlQ29ubmVjdFVybCIsInNlc3Npb25VcmwiLCJicmlkZ2VTZXNzaW9uSWQiLCJyZXBsQnJpZGdlU2Vzc2lvblVybCIsImVudklkIiwic2Vzc2lvbklkIiwicmVwbEJyaWRnZVNlc3Npb25BY3RpdmUiLCJyZXBsQnJpZGdlUmVjb25uZWN0aW5nIiwicmVwbEJyaWRnZUVudmlyb25tZW50SWQiLCJyZXBsQnJpZGdlU2Vzc2lvbklkIiwic2tpbGxzIiwiZ2V0U3RhdGUiLCJ3cml0ZVNka01lc3NhZ2VzIiwidG9vbHMiLCJtY3BDbGllbnRzIiwibW9kZWwiLCJwZXJtaXNzaW9uTW9kZSIsInRvb2xQZXJtaXNzaW9uQ29udGV4dCIsImZpbHRlciIsImFnZW50cyIsImFnZW50RGVmaW5pdGlvbnMiLCJhY3RpdmVBZ2VudHMiLCJwbHVnaW5zIiwiZmFzdE1vZGUiLCJlcnIiLCJjbGVhclRpbWVvdXQiLCJwZW5kaW5nUGVybWlzc2lvbkhhbmRsZXJzIiwiTWFwIiwicmVzcG9uc2UiLCJoYW5kbGVQZXJtaXNzaW9uUmVzcG9uc2UiLCJyZXF1ZXN0SWQiLCJyZXF1ZXN0X2lkIiwiaGFuZGxlciIsImdldCIsImRlbGV0ZSIsImlubmVyIiwic3VidHlwZSIsInRhZ3MiLCJvbkluYm91bmRNZXNzYWdlIiwib25QZXJtaXNzaW9uUmVzcG9uc2UiLCJvbkludGVycnVwdCIsImFib3J0Iiwib25TZXRNb2RlbCIsInJlc29sdmVkIiwibWFpbkxvb3BNb2RlbEZvclNlc3Npb24iLCJvblNldE1heFRoaW5raW5nVG9rZW5zIiwibWF4VG9rZW5zIiwiZW5hYmxlZCIsInRoaW5raW5nRW5hYmxlZCIsIm9uU2V0UGVybWlzc2lvbk1vZGUiLCJvayIsImVycm9yIiwiaXNCeXBhc3NQZXJtaXNzaW9uc01vZGVBdmFpbGFibGUiLCJyZWFzb24iLCJuZXh0Iiwic2V0SW1tZWRpYXRlIiwiY3VycmVudFF1ZXVlIiwiZm9yRWFjaCIsIml0ZW0iLCJyZWNoZWNrUGVybWlzc2lvbiIsIm9uU3RhdGVDaGFuZ2UiLCJpbml0aWFsTWVzc2FnZXMiLCJnZXRNZXNzYWdlcyIsInByZXZpb3VzbHlGbHVzaGVkVVVJRHMiLCJpbml0aWFsTmFtZSIsInRlYXJkb3duIiwicGVybWlzc2lvbkNhbGxiYWNrcyIsInNlbmRSZXF1ZXN0IiwidG9vbE5hbWUiLCJpbnB1dCIsInRvb2xVc2VJZCIsImRlc2NyaXB0aW9uIiwicGVybWlzc2lvblN1Z2dlc3Rpb25zIiwiYmxvY2tlZFBhdGgiLCJzZW5kQ29udHJvbFJlcXVlc3QiLCJ0eXBlIiwicmVxdWVzdCIsInRvb2xfbmFtZSIsInRvb2xfdXNlX2lkIiwicGVybWlzc2lvbl9zdWdnZXN0aW9ucyIsImJsb2NrZWRfcGF0aCIsInNlbmRSZXNwb25zZSIsInBheWxvYWQiLCJSZWNvcmQiLCJzZW5kQ29udHJvbFJlc3BvbnNlIiwiY2FuY2VsUmVxdWVzdCIsInNlbmRDb250cm9sQ2FuY2VsUmVxdWVzdCIsIm9uUmVzcG9uc2UiLCJzZXQiLCJyZXBsQnJpZGdlUGVybWlzc2lvbkNhbGxiYWNrcyIsInVybCIsImhhc0VudiIsInVwZ3JhZGVOdWRnZSIsImNhdGNoIiwiZXJyTXNnIiwic3RhcnRJbmRleCIsIk1hdGgiLCJtaW4iLCJuZXdNZXNzYWdlcyIsImkiLCJwdXNoIiwid3JpdGVNZXNzYWdlcyIsInNlbmRSZXN1bHQiXSwic291cmNlcyI6WyJ1c2VSZXBsQnJpZGdlLnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBmZWF0dXJlIH0gZnJvbSAnYnVuOmJ1bmRsZSdcbmltcG9ydCBSZWFjdCwgeyB1c2VDYWxsYmFjaywgdXNlRWZmZWN0LCB1c2VSZWYgfSBmcm9tICdyZWFjdCdcbmltcG9ydCB7IHNldE1haW5Mb29wTW9kZWxPdmVycmlkZSB9IGZyb20gJy4uL2Jvb3RzdHJhcC9zdGF0ZS5qcydcbmltcG9ydCB7XG4gIHR5cGUgQnJpZGdlUGVybWlzc2lvbkNhbGxiYWNrcyxcbiAgdHlwZSBCcmlkZ2VQZXJtaXNzaW9uUmVzcG9uc2UsXG4gIGlzQnJpZGdlUGVybWlzc2lvblJlc3BvbnNlLFxufSBmcm9tICcuLi9icmlkZ2UvYnJpZGdlUGVybWlzc2lvbkNhbGxiYWNrcy5qcydcbmltcG9ydCB7IGJ1aWxkQnJpZGdlQ29ubmVjdFVybCB9IGZyb20gJy4uL2JyaWRnZS9icmlkZ2VTdGF0dXNVdGlsLmpzJ1xuaW1wb3J0IHsgZXh0cmFjdEluYm91bmRNZXNzYWdlRmllbGRzIH0gZnJvbSAnLi4vYnJpZGdlL2luYm91bmRNZXNzYWdlcy5qcydcbmltcG9ydCB0eXBlIHsgQnJpZGdlU3RhdGUsIFJlcGxCcmlkZ2VIYW5kbGUgfSBmcm9tICcuLi9icmlkZ2UvcmVwbEJyaWRnZS5qcydcbmltcG9ydCB7IHNldFJlcGxCcmlkZ2VIYW5kbGUgfSBmcm9tICcuLi9icmlkZ2UvcmVwbEJyaWRnZUhhbmRsZS5qcydcbmltcG9ydCB0eXBlIHsgQ29tbWFuZCB9IGZyb20gJy4uL2NvbW1hbmRzLmpzJ1xuaW1wb3J0IHsgZ2V0U2xhc2hDb21tYW5kVG9vbFNraWxscywgaXNCcmlkZ2VTYWZlQ29tbWFuZCB9IGZyb20gJy4uL2NvbW1hbmRzLmpzJ1xuaW1wb3J0IHsgZ2V0UmVtb3RlU2Vzc2lvblVybCB9IGZyb20gJy4uL2NvbnN0YW50cy9wcm9kdWN0LmpzJ1xuaW1wb3J0IHsgdXNlTm90aWZpY2F0aW9ucyB9IGZyb20gJy4uL2NvbnRleHQvbm90aWZpY2F0aW9ucy5qcydcbmltcG9ydCB0eXBlIHtcbiAgUGVybWlzc2lvbk1vZGUsXG4gIFNES01lc3NhZ2UsXG59IGZyb20gJy4uL2VudHJ5cG9pbnRzL2FnZW50U2RrVHlwZXMuanMnXG5pbXBvcnQgdHlwZSB7IFNES0NvbnRyb2xSZXNwb25zZSB9IGZyb20gJy4uL2VudHJ5cG9pbnRzL3Nkay9jb250cm9sVHlwZXMuanMnXG5pbXBvcnQgeyBUZXh0IH0gZnJvbSAnLi4vaW5rLmpzJ1xuaW1wb3J0IHsgZ2V0RmVhdHVyZVZhbHVlX0NBQ0hFRF9NQVlfQkVfU1RBTEUgfSBmcm9tICcuLi9zZXJ2aWNlcy9hbmFseXRpY3MvZ3Jvd3RoYm9vay5qcydcbmltcG9ydCB7XG4gIHVzZUFwcFN0YXRlLFxuICB1c2VBcHBTdGF0ZVN0b3JlLFxuICB1c2VTZXRBcHBTdGF0ZSxcbn0gZnJvbSAnLi4vc3RhdGUvQXBwU3RhdGUuanMnXG5pbXBvcnQgdHlwZSB7IE1lc3NhZ2UgfSBmcm9tICcuLi90eXBlcy9tZXNzYWdlLmpzJ1xuaW1wb3J0IHsgZ2V0Q3dkIH0gZnJvbSAnLi4vdXRpbHMvY3dkLmpzJ1xuaW1wb3J0IHsgbG9nRm9yRGVidWdnaW5nIH0gZnJvbSAnLi4vdXRpbHMvZGVidWcuanMnXG5pbXBvcnQgeyBlcnJvck1lc3NhZ2UgfSBmcm9tICcuLi91dGlscy9lcnJvcnMuanMnXG5pbXBvcnQgeyBlbnF1ZXVlIH0gZnJvbSAnLi4vdXRpbHMvbWVzc2FnZVF1ZXVlTWFuYWdlci5qcydcbmltcG9ydCB7IGJ1aWxkU3lzdGVtSW5pdE1lc3NhZ2UgfSBmcm9tICcuLi91dGlscy9tZXNzYWdlcy9zeXN0ZW1Jbml0LmpzJ1xuaW1wb3J0IHtcbiAgY3JlYXRlQnJpZGdlU3RhdHVzTWVzc2FnZSxcbiAgY3JlYXRlU3lzdGVtTWVzc2FnZSxcbn0gZnJvbSAnLi4vdXRpbHMvbWVzc2FnZXMuanMnXG5pbXBvcnQge1xuICBnZXRBdXRvTW9kZVVuYXZhaWxhYmxlTm90aWZpY2F0aW9uLFxuICBnZXRBdXRvTW9kZVVuYXZhaWxhYmxlUmVhc29uLFxuICBpc0F1dG9Nb2RlR2F0ZUVuYWJsZWQsXG4gIGlzQnlwYXNzUGVybWlzc2lvbnNNb2RlRGlzYWJsZWQsXG4gIHRyYW5zaXRpb25QZXJtaXNzaW9uTW9kZSxcbn0gZnJvbSAnLi4vdXRpbHMvcGVybWlzc2lvbnMvcGVybWlzc2lvblNldHVwLmpzJ1xuaW1wb3J0IHsgZ2V0TGVhZGVyVG9vbFVzZUNvbmZpcm1RdWV1ZSB9IGZyb20gJy4uL3V0aWxzL3N3YXJtL2xlYWRlclBlcm1pc3Npb25CcmlkZ2UuanMnXG5cbi8qKiBIb3cgbG9uZyBhZnRlciBhIGZhaWx1cmUgYmVmb3JlIHJlcGxCcmlkZ2VFbmFibGVkIGlzIGF1dG8tY2xlYXJlZCAoc3RvcHMgcmV0cmllcykuICovXG5leHBvcnQgY29uc3QgQlJJREdFX0ZBSUxVUkVfRElTTUlTU19NUyA9IDEwXzAwMFxuXG4vKipcbiAqIE1heCBjb25zZWN1dGl2ZSBpbml0UmVwbEJyaWRnZSBmYWlsdXJlcyBiZWZvcmUgdGhlIGhvb2sgc3RvcHMgcmUtYXR0ZW1wdGluZ1xuICogZm9yIHRoZSBzZXNzaW9uIGxpZmV0aW1lLiBHdWFyZHMgYWdhaW5zdCBwYXRocyB0aGF0IGZsaXAgcmVwbEJyaWRnZUVuYWJsZWRcbiAqIGJhY2sgb24gYWZ0ZXIgYXV0by1kaXNhYmxlIChzZXR0aW5ncyBzeW5jLCAvcmVtb3RlLWNvbnRyb2wsIGNvbmZpZyB0b29sKVxuICogd2hlbiB0aGUgdW5kZXJseWluZyBPQXV0aCBpcyB1bnJlY292ZXJhYmxlIOKAlCBlYWNoIHJlLWF0dGVtcHQgaXMgYW5vdGhlclxuICogZ3VhcmFudGVlZCA0MDEgYWdhaW5zdCBQT1NUIC92MS9lbnZpcm9ubWVudHMvYnJpZGdlLiBEYXRhZG9nIDIwMjYtMDMtMDg6XG4gKiB0b3Agc3R1Y2sgY2xpZW50IGdlbmVyYXRlZCAyLDg3OSDDlyA0MDEvZGF5IGFsb25lICgxNyUgb2YgYWxsIDQwMXMgb24gdGhlXG4gKiByb3V0ZSkuXG4gKi9cbmNvbnN0IE1BWF9DT05TRUNVVElWRV9JTklUX0ZBSUxVUkVTID0gM1xuXG4vKipcbiAqIEhvb2sgdGhhdCBpbml0aWFsaXplcyBhbiBhbHdheXMtb24gYnJpZGdlIGNvbm5lY3Rpb24gaW4gdGhlIGJhY2tncm91bmRcbiAqIGFuZCB3cml0ZXMgbmV3IHVzZXIvYXNzaXN0YW50IG1lc3NhZ2VzIHRvIHRoZSBicmlkZ2Ugc2Vzc2lvbi5cbiAqXG4gKiBTaWxlbnRseSBza2lwcyBpZiBicmlkZ2UgaXMgbm90IGVuYWJsZWQgb3IgdXNlciBpcyBub3QgT0F1dGgtYXV0aGVudGljYXRlZC5cbiAqXG4gKiBXYXRjaGVzIEFwcFN0YXRlLnJlcGxCcmlkZ2VFbmFibGVkIOKAlCB3aGVuIHRvZ2dsZWQgb2ZmICh2aWEgL2NvbmZpZyBvciBmb290ZXIpLFxuICogdGhlIGJyaWRnZSBpcyB0b3JuIGRvd24uIFdoZW4gdG9nZ2xlZCBiYWNrIG9uLCBpdCByZS1pbml0aWFsaXplcy5cbiAqXG4gKiBJbmJvdW5kIG1lc3NhZ2VzIGZyb20gY2xhdWRlLmFpIGFyZSBpbmplY3RlZCBpbnRvIHRoZSBSRVBMIHZpYSBxdWV1ZWRDb21tYW5kcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHVzZVJlcGxCcmlkZ2UoXG4gIG1lc3NhZ2VzOiBNZXNzYWdlW10sXG4gIHNldE1lc3NhZ2VzOiAoYWN0aW9uOiBSZWFjdC5TZXRTdGF0ZUFjdGlvbjxNZXNzYWdlW10+KSA9PiB2b2lkLFxuICBhYm9ydENvbnRyb2xsZXJSZWY6IFJlYWN0LlJlZk9iamVjdDxBYm9ydENvbnRyb2xsZXIgfCBudWxsPixcbiAgY29tbWFuZHM6IHJlYWRvbmx5IENvbW1hbmRbXSxcbiAgbWFpbkxvb3BNb2RlbDogc3RyaW5nLFxuKTogeyBzZW5kQnJpZGdlUmVzdWx0OiAoKSA9PiB2b2lkIH0ge1xuICBjb25zdCBoYW5kbGVSZWYgPSB1c2VSZWY8UmVwbEJyaWRnZUhhbmRsZSB8IG51bGw+KG51bGwpXG4gIGNvbnN0IHRlYXJkb3duUHJvbWlzZVJlZiA9IHVzZVJlZjxQcm9taXNlPHZvaWQ+IHwgdW5kZWZpbmVkPih1bmRlZmluZWQpXG4gIGNvbnN0IGxhc3RXcml0dGVuSW5kZXhSZWYgPSB1c2VSZWYoMClcbiAgLy8gVHJhY2tzIFVVSURzIGFscmVhZHkgZmx1c2hlZCBhcyBpbml0aWFsIG1lc3NhZ2VzLiBQZXJzaXN0cyBhY3Jvc3NcbiAgLy8gYnJpZGdlIHJlY29ubmVjdGlvbnMgc28gQnJpZGdlICMyKyBvbmx5IHNlbmRzIG5ldyBtZXNzYWdlcyDigJQgc2VuZGluZ1xuICAvLyBkdXBsaWNhdGUgVVVJRHMgY2F1c2VzIHRoZSBzZXJ2ZXIgdG8ga2lsbCB0aGUgV2ViU29ja2V0LlxuICBjb25zdCBmbHVzaGVkVVVJRHNSZWYgPSB1c2VSZWYobmV3IFNldDxzdHJpbmc+KCkpXG4gIGNvbnN0IGZhaWx1cmVUaW1lb3V0UmVmID0gdXNlUmVmPFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgdW5kZWZpbmVkPihcbiAgICB1bmRlZmluZWQsXG4gIClcbiAgLy8gUGVyc2lzdHMgYWNyb3NzIGVmZmVjdCByZS1ydW5zICh1bmxpa2UgdGhlIGVmZmVjdCdzIGxvY2FsIHN0YXRlKS4gUmVzZXRcbiAgLy8gb25seSBvbiBzdWNjZXNzZnVsIGluaXQuIEhpdHMgTUFYX0NPTlNFQ1VUSVZFX0lOSVRfRkFJTFVSRVMg4oaSIGZ1c2UgYmxvd25cbiAgLy8gZm9yIHRoZSBzZXNzaW9uLCByZWdhcmRsZXNzIG9mIHJlcGxCcmlkZ2VFbmFibGVkIHJlLXRvZ2dsaW5nLlxuICBjb25zdCBjb25zZWN1dGl2ZUZhaWx1cmVzUmVmID0gdXNlUmVmKDApXG4gIGNvbnN0IHNldEFwcFN0YXRlID0gdXNlU2V0QXBwU3RhdGUoKVxuICBjb25zdCBjb21tYW5kc1JlZiA9IHVzZVJlZihjb21tYW5kcylcbiAgY29tbWFuZHNSZWYuY3VycmVudCA9IGNvbW1hbmRzXG4gIGNvbnN0IG1haW5Mb29wTW9kZWxSZWYgPSB1c2VSZWYobWFpbkxvb3BNb2RlbClcbiAgbWFpbkxvb3BNb2RlbFJlZi5jdXJyZW50ID0gbWFpbkxvb3BNb2RlbFxuICBjb25zdCBtZXNzYWdlc1JlZiA9IHVzZVJlZihtZXNzYWdlcylcbiAgbWVzc2FnZXNSZWYuY3VycmVudCA9IG1lc3NhZ2VzXG4gIGNvbnN0IHN0b3JlID0gdXNlQXBwU3RhdGVTdG9yZSgpXG4gIGNvbnN0IHsgYWRkTm90aWZpY2F0aW9uIH0gPSB1c2VOb3RpZmljYXRpb25zKClcbiAgY29uc3QgcmVwbEJyaWRnZUVuYWJsZWQgPSBmZWF0dXJlKCdCUklER0VfTU9ERScpXG4gICAgPyAvLyBiaW9tZS1pZ25vcmUgbGludC9jb3JyZWN0bmVzcy91c2VIb29rQXRUb3BMZXZlbDogZmVhdHVyZSgpIGlzIGEgY29tcGlsZS10aW1lIGNvbnN0YW50XG4gICAgICB1c2VBcHBTdGF0ZShzID0+IHMucmVwbEJyaWRnZUVuYWJsZWQpXG4gICAgOiBmYWxzZVxuICBjb25zdCByZXBsQnJpZGdlQ29ubmVjdGVkID0gZmVhdHVyZSgnQlJJREdFX01PREUnKVxuICAgID8gLy8gYmlvbWUtaWdub3JlIGxpbnQvY29ycmVjdG5lc3MvdXNlSG9va0F0VG9wTGV2ZWw6IGZlYXR1cmUoKSBpcyBhIGNvbXBpbGUtdGltZSBjb25zdGFudFxuICAgICAgdXNlQXBwU3RhdGUocyA9PiBzLnJlcGxCcmlkZ2VDb25uZWN0ZWQpXG4gICAgOiBmYWxzZVxuICBjb25zdCByZXBsQnJpZGdlT3V0Ym91bmRPbmx5ID0gZmVhdHVyZSgnQlJJREdFX01PREUnKVxuICAgID8gLy8gYmlvbWUtaWdub3JlIGxpbnQvY29ycmVjdG5lc3MvdXNlSG9va0F0VG9wTGV2ZWw6IGZlYXR1cmUoKSBpcyBhIGNvbXBpbGUtdGltZSBjb25zdGFudFxuICAgICAgdXNlQXBwU3RhdGUocyA9PiBzLnJlcGxCcmlkZ2VPdXRib3VuZE9ubHkpXG4gICAgOiBmYWxzZVxuICBjb25zdCByZXBsQnJpZGdlSW5pdGlhbE5hbWUgPSBmZWF0dXJlKCdCUklER0VfTU9ERScpXG4gICAgPyAvLyBiaW9tZS1pZ25vcmUgbGludC9jb3JyZWN0bmVzcy91c2VIb29rQXRUb3BMZXZlbDogZmVhdHVyZSgpIGlzIGEgY29tcGlsZS10aW1lIGNvbnN0YW50XG4gICAgICB1c2VBcHBTdGF0ZShzID0+IHMucmVwbEJyaWRnZUluaXRpYWxOYW1lKVxuICAgIDogdW5kZWZpbmVkXG5cbiAgLy8gSW5pdGlhbGl6ZS90ZWFyZG93biBicmlkZ2Ugd2hlbiBlbmFibGVkIHN0YXRlIGNoYW5nZXMuXG4gIC8vIFBhc3NlcyBjdXJyZW50IG1lc3NhZ2VzIGFzIGluaXRpYWxNZXNzYWdlcyBzbyB0aGUgcmVtb3RlIHNlc3Npb25cbiAgLy8gc3RhcnRzIHdpdGggdGhlIGV4aXN0aW5nIGNvbnZlcnNhdGlvbiBjb250ZXh0IChlLmcuIGZyb20gL2JyaWRnZSkuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgLy8gZmVhdHVyZSgpIGNoZWNrIG11c3QgdXNlIHBvc2l0aXZlIHBhdHRlcm4gZm9yIGRlYWQgY29kZSBlbGltaW5hdGlvbiDigJRcbiAgICAvLyBuZWdhdGl2ZSBwYXR0ZXJuIChpZiAoIWZlYXR1cmUoLi4uKSkgcmV0dXJuKSBkb2VzIE5PVCBlbGltaW5hdGVcbiAgICAvLyBkeW5hbWljIGltcG9ydHMgYmVsb3cuXG4gICAgaWYgKGZlYXR1cmUoJ0JSSURHRV9NT0RFJykpIHtcbiAgICAgIGlmICghcmVwbEJyaWRnZUVuYWJsZWQpIHJldHVyblxuXG4gICAgICBjb25zdCBvdXRib3VuZE9ubHkgPSByZXBsQnJpZGdlT3V0Ym91bmRPbmx5XG4gICAgICBmdW5jdGlvbiBub3RpZnlCcmlkZ2VGYWlsZWQoZGV0YWlsPzogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIGlmIChvdXRib3VuZE9ubHkpIHJldHVyblxuICAgICAgICBhZGROb3RpZmljYXRpb24oe1xuICAgICAgICAgIGtleTogJ2JyaWRnZS1mYWlsZWQnLFxuICAgICAgICAgIGpzeDogKFxuICAgICAgICAgICAgPD5cbiAgICAgICAgICAgICAgPFRleHQgY29sb3I9XCJlcnJvclwiPlJlbW90ZSBDb250cm9sIGZhaWxlZDwvVGV4dD5cbiAgICAgICAgICAgICAge2RldGFpbCAmJiA8VGV4dCBkaW1Db2xvcj4gwrcge2RldGFpbH08L1RleHQ+fVxuICAgICAgICAgICAgPC8+XG4gICAgICAgICAgKSxcbiAgICAgICAgICBwcmlvcml0eTogJ2ltbWVkaWF0ZScsXG4gICAgICAgIH0pXG4gICAgICB9XG5cbiAgICAgIGlmIChjb25zZWN1dGl2ZUZhaWx1cmVzUmVmLmN1cnJlbnQgPj0gTUFYX0NPTlNFQ1VUSVZFX0lOSVRfRkFJTFVSRVMpIHtcbiAgICAgICAgbG9nRm9yRGVidWdnaW5nKFxuICAgICAgICAgIGBbYnJpZGdlOnJlcGxdIEhvb2s6ICR7Y29uc2VjdXRpdmVGYWlsdXJlc1JlZi5jdXJyZW50fSBjb25zZWN1dGl2ZSBpbml0IGZhaWx1cmVzLCBub3QgcmV0cnlpbmcgdGhpcyBzZXNzaW9uYCxcbiAgICAgICAgKVxuICAgICAgICAvLyBDbGVhciByZXBsQnJpZGdlRW5hYmxlZCBzbyAvcmVtb3RlLWNvbnRyb2wgZG9lc24ndCBtaXN0YWtlbmx5IHNob3dcbiAgICAgICAgLy8gQnJpZGdlRGlzY29ubmVjdERpYWxvZyBmb3IgYSBicmlkZ2UgdGhhdCBuZXZlciBjb25uZWN0ZWQuXG4gICAgICAgIGNvbnN0IGZ1c2VIaW50ID0gJ2Rpc2FibGVkIGFmdGVyIHJlcGVhdGVkIGZhaWx1cmVzIMK3IHJlc3RhcnQgdG8gcmV0cnknXG4gICAgICAgIG5vdGlmeUJyaWRnZUZhaWxlZChmdXNlSGludClcbiAgICAgICAgc2V0QXBwU3RhdGUocHJldiA9PiB7XG4gICAgICAgICAgaWYgKHByZXYucmVwbEJyaWRnZUVycm9yID09PSBmdXNlSGludCAmJiAhcHJldi5yZXBsQnJpZGdlRW5hYmxlZClcbiAgICAgICAgICAgIHJldHVybiBwcmV2XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgICByZXBsQnJpZGdlRXJyb3I6IGZ1c2VIaW50LFxuICAgICAgICAgICAgcmVwbEJyaWRnZUVuYWJsZWQ6IGZhbHNlLFxuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIGxldCBjYW5jZWxsZWQgPSBmYWxzZVxuICAgICAgLy8gQ2FwdHVyZSBtZXNzYWdlcy5sZW5ndGggbm93IHNvIHdlIGRvbid0IHJlLXNlbmQgaW5pdGlhbCBtZXNzYWdlc1xuICAgICAgLy8gdGhyb3VnaCB3cml0ZU1lc3NhZ2VzIGFmdGVyIHRoZSBicmlkZ2UgY29ubmVjdHMuXG4gICAgICBjb25zdCBpbml0aWFsTWVzc2FnZUNvdW50ID0gbWVzc2FnZXMubGVuZ3RoXG5cbiAgICAgIHZvaWQgKGFzeW5jICgpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAvLyBXYWl0IGZvciBhbnkgaW4tcHJvZ3Jlc3MgdGVhcmRvd24gdG8gY29tcGxldGUgYmVmb3JlIHJlZ2lzdGVyaW5nXG4gICAgICAgICAgLy8gYSBuZXcgZW52aXJvbm1lbnQuIFdpdGhvdXQgdGhpcywgdGhlIGRlcmVnaXN0ZXIgSFRUUCBjYWxsIGZyb21cbiAgICAgICAgICAvLyB0aGUgcHJldmlvdXMgdGVhcmRvd24gcmFjZXMgd2l0aCB0aGUgbmV3IHJlZ2lzdGVyIGNhbGwsIGFuZCB0aGVcbiAgICAgICAgICAvLyBzZXJ2ZXIgbWF5IHRlYXIgZG93biB0aGUgZnJlc2hseS1jcmVhdGVkIGVudmlyb25tZW50LlxuICAgICAgICAgIGlmICh0ZWFyZG93blByb21pc2VSZWYuY3VycmVudCkge1xuICAgICAgICAgICAgbG9nRm9yRGVidWdnaW5nKFxuICAgICAgICAgICAgICAnW2JyaWRnZTpyZXBsXSBIb29rOiB3YWl0aW5nIGZvciBwcmV2aW91cyB0ZWFyZG93biB0byBjb21wbGV0ZSBiZWZvcmUgcmUtaW5pdCcsXG4gICAgICAgICAgICApXG4gICAgICAgICAgICBhd2FpdCB0ZWFyZG93blByb21pc2VSZWYuY3VycmVudFxuICAgICAgICAgICAgdGVhcmRvd25Qcm9taXNlUmVmLmN1cnJlbnQgPSB1bmRlZmluZWRcbiAgICAgICAgICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgICAgICAgICAgJ1ticmlkZ2U6cmVwbF0gSG9vazogcHJldmlvdXMgdGVhcmRvd24gY29tcGxldGUsIHByb2NlZWRpbmcgd2l0aCByZS1pbml0JyxcbiAgICAgICAgICAgIClcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGNhbmNlbGxlZCkgcmV0dXJuXG5cbiAgICAgICAgICAvLyBEeW5hbWljIGltcG9ydCBzbyB0aGUgbW9kdWxlIGlzIHRyZWUtc2hha2VuIGluIGV4dGVybmFsIGJ1aWxkc1xuICAgICAgICAgIGNvbnN0IHsgaW5pdFJlcGxCcmlkZ2UgfSA9IGF3YWl0IGltcG9ydCgnLi4vYnJpZGdlL2luaXRSZXBsQnJpZGdlLmpzJylcbiAgICAgICAgICBjb25zdCB7IHNob3VsZFNob3dBcHBVcGdyYWRlTWVzc2FnZSB9ID0gYXdhaXQgaW1wb3J0KFxuICAgICAgICAgICAgJy4uL2JyaWRnZS9lbnZMZXNzQnJpZGdlQ29uZmlnLmpzJ1xuICAgICAgICAgIClcblxuICAgICAgICAgIC8vIEFzc2lzdGFudCBtb2RlOiBwZXJwZXR1YWwgYnJpZGdlIHNlc3Npb24g4oCUIGNsYXVkZS5haSBzaG93cyBvbmVcbiAgICAgICAgICAvLyBjb250aW51b3VzIGNvbnZlcnNhdGlvbiBhY3Jvc3MgQ0xJIHJlc3RhcnRzIGluc3RlYWQgb2YgYSBuZXdcbiAgICAgICAgICAvLyBzZXNzaW9uIHBlciBpbnZvY2F0aW9uLiBpbml0QnJpZGdlQ29yZSByZWFkcyBicmlkZ2UtcG9pbnRlci5qc29uXG4gICAgICAgICAgLy8gKHRoZSBzYW1lIGNyYXNoLXJlY292ZXJ5IGZpbGUgIzIwNzM1IGFkZGVkKSBhbmQgcmV1c2VzIGl0c1xuICAgICAgICAgIC8vIHtlbnZpcm9ubWVudElkLCBzZXNzaW9uSWR9IHZpYSByZXVzZUVudmlyb25tZW50SWQgK1xuICAgICAgICAgIC8vIGFwaS5yZWNvbm5lY3RTZXNzaW9uKCkuIFRlYXJkb3duIHNraXBzIGFyY2hpdmUvZGVyZWdpc3Rlci9cbiAgICAgICAgICAvLyBwb2ludGVyLWNsZWFyIHNvIHRoZSBzZXNzaW9uIHN1cnZpdmVzIGNsZWFuIGV4aXRzLCBub3QganVzdFxuICAgICAgICAgIC8vIGNyYXNoZXMuIE5vbi1hc3Npc3RhbnQgYnJpZGdlcyBjbGVhciB0aGUgcG9pbnRlciBvbiB0ZWFyZG93blxuICAgICAgICAgIC8vIChjcmFzaC1yZWNvdmVyeSBvbmx5KS5cbiAgICAgICAgICBsZXQgcGVycGV0dWFsID0gZmFsc2VcbiAgICAgICAgICBpZiAoZmVhdHVyZSgnS0FJUk9TJykpIHtcbiAgICAgICAgICAgIGNvbnN0IHsgaXNBc3Npc3RhbnRNb2RlIH0gPSBhd2FpdCBpbXBvcnQoJy4uL2Fzc2lzdGFudC9pbmRleC5qcycpXG4gICAgICAgICAgICBwZXJwZXR1YWwgPSBpc0Fzc2lzdGFudE1vZGUoKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFdoZW4gYSB1c2VyIG1lc3NhZ2UgYXJyaXZlcyBmcm9tIGNsYXVkZS5haSwgaW5qZWN0IGl0IGludG8gdGhlIFJFUEwuXG4gICAgICAgICAgLy8gUHJlc2VydmVzIHRoZSBvcmlnaW5hbCBVVUlEIHNvIHRoYXQgd2hlbiB0aGUgbWVzc2FnZSBpcyBmb3J3YXJkZWRcbiAgICAgICAgICAvLyBiYWNrIHRvIENDUiwgaXQgbWF0Y2hlcyB0aGUgb3JpZ2luYWwg4oCUIGF2b2lkaW5nIGR1cGxpY2F0ZSBtZXNzYWdlcy5cbiAgICAgICAgICAvL1xuICAgICAgICAgIC8vIEFzeW5jIGJlY2F1c2UgZmlsZV9hdHRhY2htZW50cyAoaWYgcHJlc2VudCkgbmVlZCBhIG5ldHdvcmsgZmV0Y2ggK1xuICAgICAgICAgIC8vIGRpc2sgd3JpdGUgYmVmb3JlIHdlIGVucXVldWUgd2l0aCB0aGUgQHBhdGggcHJlZml4LiBDYWxsZXIgZG9lc24ndFxuICAgICAgICAgIC8vIGF3YWl0IOKAlCBtZXNzYWdlcyB3aXRoIGF0dGFjaG1lbnRzIGp1c3QgbGFuZCBpbiB0aGUgcXVldWUgc2xpZ2h0bHlcbiAgICAgICAgICAvLyBsYXRlciwgd2hpY2ggaXMgZmluZSAod2ViIG1lc3NhZ2VzIGFyZW4ndCByYXBpZC1maXJlKS5cbiAgICAgICAgICBhc3luYyBmdW5jdGlvbiBoYW5kbGVJbmJvdW5kTWVzc2FnZShtc2c6IFNES01lc3NhZ2UpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IGZpZWxkcyA9IGV4dHJhY3RJbmJvdW5kTWVzc2FnZUZpZWxkcyhtc2cpXG4gICAgICAgICAgICAgIGlmICghZmllbGRzKSByZXR1cm5cblxuICAgICAgICAgICAgICBjb25zdCB7IHV1aWQgfSA9IGZpZWxkc1xuXG4gICAgICAgICAgICAgIC8vIER5bmFtaWMgaW1wb3J0IGtlZXBzIHRoZSBicmlkZ2UgY29kZSBvdXQgb2Ygbm9uLUJSSURHRV9NT0RFIGJ1aWxkcy5cbiAgICAgICAgICAgICAgY29uc3QgeyByZXNvbHZlQW5kUHJlcGVuZCB9ID0gYXdhaXQgaW1wb3J0KFxuICAgICAgICAgICAgICAgICcuLi9icmlkZ2UvaW5ib3VuZEF0dGFjaG1lbnRzLmpzJ1xuICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgIGxldCBzYW5pdGl6ZWQgPSBmaWVsZHMuY29udGVudFxuICAgICAgICAgICAgICBpZiAoZmVhdHVyZSgnS0FJUk9TX0dJVEhVQl9XRUJIT09LUycpKSB7XG4gICAgICAgICAgICAgICAgLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0cyAqL1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgc2FuaXRpemVJbmJvdW5kV2ViaG9va0NvbnRlbnQgfSA9XG4gICAgICAgICAgICAgICAgICByZXF1aXJlKCcuLi9icmlkZ2Uvd2ViaG9va1Nhbml0aXplci5qcycpIGFzIHR5cGVvZiBpbXBvcnQoJy4uL2JyaWRnZS93ZWJob29rU2FuaXRpemVyLmpzJylcbiAgICAgICAgICAgICAgICAvKiBlc2xpbnQtZW5hYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cbiAgICAgICAgICAgICAgICBzYW5pdGl6ZWQgPSBzYW5pdGl6ZUluYm91bmRXZWJob29rQ29udGVudChmaWVsZHMuY29udGVudClcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgcmVzb2x2ZUFuZFByZXBlbmQobXNnLCBzYW5pdGl6ZWQpXG5cbiAgICAgICAgICAgICAgY29uc3QgcHJldmlldyA9XG4gICAgICAgICAgICAgICAgdHlwZW9mIGNvbnRlbnQgPT09ICdzdHJpbmcnXG4gICAgICAgICAgICAgICAgICA/IGNvbnRlbnQuc2xpY2UoMCwgODApXG4gICAgICAgICAgICAgICAgICA6IGBbJHtjb250ZW50Lmxlbmd0aH0gY29udGVudCBibG9ja3NdYFxuICAgICAgICAgICAgICBsb2dGb3JEZWJ1Z2dpbmcoXG4gICAgICAgICAgICAgICAgYFticmlkZ2U6cmVwbF0gSW5qZWN0aW5nIGluYm91bmQgdXNlciBtZXNzYWdlOiAke3ByZXZpZXd9JHt1dWlkID8gYCB1dWlkPSR7dXVpZH1gIDogJyd9YCxcbiAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICBlbnF1ZXVlKHtcbiAgICAgICAgICAgICAgICB2YWx1ZTogY29udGVudCxcbiAgICAgICAgICAgICAgICBtb2RlOiAncHJvbXB0JyBhcyBjb25zdCxcbiAgICAgICAgICAgICAgICB1dWlkLFxuICAgICAgICAgICAgICAgIC8vIHNraXBTbGFzaENvbW1hbmRzIHN0YXlzIHRydWUgYXMgZGVmZW5zZS1pbi1kZXB0aCDigJRcbiAgICAgICAgICAgICAgICAvLyBwcm9jZXNzVXNlcklucHV0QmFzZSBvdmVycmlkZXMgaXQgaW50ZXJuYWxseSB3aGVuIGJyaWRnZU9yaWdpblxuICAgICAgICAgICAgICAgIC8vIGlzIHNldCBBTkQgdGhlIHJlc29sdmVkIGNvbW1hbmQgcGFzc2VzIGlzQnJpZGdlU2FmZUNvbW1hbmQuXG4gICAgICAgICAgICAgICAgLy8gVGhpcyBrZWVwcyBleGl0LXdvcmQgc3VwcHJlc3Npb24gYW5kIGltbWVkaWF0ZS1jb21tYW5kIGJsb2Nrc1xuICAgICAgICAgICAgICAgIC8vIGludGFjdCBmb3IgYW55IGNvZGUgcGF0aCB0aGF0IGNoZWNrcyBza2lwU2xhc2hDb21tYW5kcyBkaXJlY3RseS5cbiAgICAgICAgICAgICAgICBza2lwU2xhc2hDb21tYW5kczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBicmlkZ2VPcmlnaW46IHRydWUsXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgICAgICAgICAgICBgW2JyaWRnZTpyZXBsXSBoYW5kbGVJbmJvdW5kTWVzc2FnZSBmYWlsZWQ6ICR7ZX1gLFxuICAgICAgICAgICAgICAgIHsgbGV2ZWw6ICdlcnJvcicgfSxcbiAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFN0YXRlIGNoYW5nZSBjYWxsYmFjayDigJQgbWFwcyBicmlkZ2UgbGlmZWN5Y2xlIGV2ZW50cyB0byBBcHBTdGF0ZS5cbiAgICAgICAgICBmdW5jdGlvbiBoYW5kbGVTdGF0ZUNoYW5nZShcbiAgICAgICAgICAgIHN0YXRlOiBCcmlkZ2VTdGF0ZSxcbiAgICAgICAgICAgIGRldGFpbD86IHN0cmluZyxcbiAgICAgICAgICApOiB2b2lkIHtcbiAgICAgICAgICAgIGlmIChjYW5jZWxsZWQpIHJldHVyblxuICAgICAgICAgICAgaWYgKG91dGJvdW5kT25seSkge1xuICAgICAgICAgICAgICBsb2dGb3JEZWJ1Z2dpbmcoXG4gICAgICAgICAgICAgICAgYFticmlkZ2U6cmVwbF0gTWlycm9yIHN0YXRlPSR7c3RhdGV9JHtkZXRhaWwgPyBgIGRldGFpbD0ke2RldGFpbH1gIDogJyd9YCxcbiAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAvLyBTeW5jIHJlcGxCcmlkZ2VDb25uZWN0ZWQgc28gdGhlIGZvcndhcmRpbmcgZWZmZWN0IHN0YXJ0cy9zdG9wc1xuICAgICAgICAgICAgICAvLyB3cml0aW5nIGFzIHRoZSB0cmFuc3BvcnQgY29tZXMgdXAgb3IgZGllcy5cbiAgICAgICAgICAgICAgaWYgKHN0YXRlID09PSAnZmFpbGVkJykge1xuICAgICAgICAgICAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4ge1xuICAgICAgICAgICAgICAgICAgaWYgKCFwcmV2LnJlcGxCcmlkZ2VDb25uZWN0ZWQpIHJldHVybiBwcmV2XG4gICAgICAgICAgICAgICAgICByZXR1cm4geyAuLi5wcmV2LCByZXBsQnJpZGdlQ29ubmVjdGVkOiBmYWxzZSB9XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gJ3JlYWR5JyB8fCBzdGF0ZSA9PT0gJ2Nvbm5lY3RlZCcpIHtcbiAgICAgICAgICAgICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+IHtcbiAgICAgICAgICAgICAgICAgIGlmIChwcmV2LnJlcGxCcmlkZ2VDb25uZWN0ZWQpIHJldHVybiBwcmV2XG4gICAgICAgICAgICAgICAgICByZXR1cm4geyAuLi5wcmV2LCByZXBsQnJpZGdlQ29ubmVjdGVkOiB0cnVlIH1cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgaGFuZGxlID0gaGFuZGxlUmVmLmN1cnJlbnRcbiAgICAgICAgICAgIHN3aXRjaCAoc3RhdGUpIHtcbiAgICAgICAgICAgICAgY2FzZSAncmVhZHknOlxuICAgICAgICAgICAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4ge1xuICAgICAgICAgICAgICAgICAgY29uc3QgY29ubmVjdFVybCA9XG4gICAgICAgICAgICAgICAgICAgIGhhbmRsZSAmJiBoYW5kbGUuZW52aXJvbm1lbnRJZCAhPT0gJydcbiAgICAgICAgICAgICAgICAgICAgICA/IGJ1aWxkQnJpZGdlQ29ubmVjdFVybChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaGFuZGxlLmVudmlyb25tZW50SWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGhhbmRsZS5zZXNzaW9uSW5ncmVzc1VybCxcbiAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgICA6IHByZXYucmVwbEJyaWRnZUNvbm5lY3RVcmxcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHNlc3Npb25VcmwgPSBoYW5kbGVcbiAgICAgICAgICAgICAgICAgICAgPyBnZXRSZW1vdGVTZXNzaW9uVXJsKFxuICAgICAgICAgICAgICAgICAgICAgICAgaGFuZGxlLmJyaWRnZVNlc3Npb25JZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhbmRsZS5zZXNzaW9uSW5ncmVzc1VybCxcbiAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgIDogcHJldi5yZXBsQnJpZGdlU2Vzc2lvblVybFxuICAgICAgICAgICAgICAgICAgY29uc3QgZW52SWQgPSBoYW5kbGU/LmVudmlyb25tZW50SWRcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHNlc3Npb25JZCA9IGhhbmRsZT8uYnJpZGdlU2Vzc2lvbklkXG4gICAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgICAgIHByZXYucmVwbEJyaWRnZUNvbm5lY3RlZCAmJlxuICAgICAgICAgICAgICAgICAgICAhcHJldi5yZXBsQnJpZGdlU2Vzc2lvbkFjdGl2ZSAmJlxuICAgICAgICAgICAgICAgICAgICAhcHJldi5yZXBsQnJpZGdlUmVjb25uZWN0aW5nICYmXG4gICAgICAgICAgICAgICAgICAgIHByZXYucmVwbEJyaWRnZUNvbm5lY3RVcmwgPT09IGNvbm5lY3RVcmwgJiZcbiAgICAgICAgICAgICAgICAgICAgcHJldi5yZXBsQnJpZGdlU2Vzc2lvblVybCA9PT0gc2Vzc2lvblVybCAmJlxuICAgICAgICAgICAgICAgICAgICBwcmV2LnJlcGxCcmlkZ2VFbnZpcm9ubWVudElkID09PSBlbnZJZCAmJlxuICAgICAgICAgICAgICAgICAgICBwcmV2LnJlcGxCcmlkZ2VTZXNzaW9uSWQgPT09IHNlc3Npb25JZFxuICAgICAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwcmV2XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgICAgICAgICAgICByZXBsQnJpZGdlQ29ubmVjdGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICByZXBsQnJpZGdlU2Vzc2lvbkFjdGl2ZTogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIHJlcGxCcmlkZ2VSZWNvbm5lY3Rpbmc6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICByZXBsQnJpZGdlQ29ubmVjdFVybDogY29ubmVjdFVybCxcbiAgICAgICAgICAgICAgICAgICAgcmVwbEJyaWRnZVNlc3Npb25Vcmw6IHNlc3Npb25VcmwsXG4gICAgICAgICAgICAgICAgICAgIHJlcGxCcmlkZ2VFbnZpcm9ubWVudElkOiBlbnZJZCxcbiAgICAgICAgICAgICAgICAgICAgcmVwbEJyaWRnZVNlc3Npb25JZDogc2Vzc2lvbklkLFxuICAgICAgICAgICAgICAgICAgICByZXBsQnJpZGdlRXJyb3I6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgIGNhc2UgJ2Nvbm5lY3RlZCc6IHtcbiAgICAgICAgICAgICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+IHtcbiAgICAgICAgICAgICAgICAgIGlmIChwcmV2LnJlcGxCcmlkZ2VTZXNzaW9uQWN0aXZlKSByZXR1cm4gcHJldlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICAgICAgICAgICAgcmVwbEJyaWRnZUNvbm5lY3RlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgcmVwbEJyaWRnZVNlc3Npb25BY3RpdmU6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIHJlcGxCcmlkZ2VSZWNvbm5lY3Rpbmc6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICByZXBsQnJpZGdlRXJyb3I6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC8vIFNlbmQgc3lzdGVtL2luaXQgc28gcmVtb3RlIGNsaWVudHMgKHdlYi9pT1MvQW5kcm9pZCkgZ2V0XG4gICAgICAgICAgICAgICAgLy8gc2Vzc2lvbiBtZXRhZGF0YS4gUkVQTCB1c2VzIHF1ZXJ5KCkgZGlyZWN0bHkg4oCUIG5ldmVyIGhpdHNcbiAgICAgICAgICAgICAgICAvLyBRdWVyeUVuZ2luZSdzIFNES01lc3NhZ2UgbGF5ZXIg4oCUIHNvIHRoaXMgaXMgdGhlIG9ubHkgcGF0aFxuICAgICAgICAgICAgICAgIC8vIHRvIHB1dCBzeXN0ZW0vaW5pdCBvbiB0aGUgUkVQTC1icmlkZ2Ugd2lyZS4gU2tpbGxzIGxvYWQgaXNcbiAgICAgICAgICAgICAgICAvLyBhc3luYyAobWVtb2l6ZWQsIGNoZWFwIGFmdGVyIFJFUEwgc3RhcnR1cCk7IGZpcmUtYW5kLWZvcmdldFxuICAgICAgICAgICAgICAgIC8vIHNvIHRoZSBjb25uZWN0ZWQtc3RhdGUgdHJhbnNpdGlvbiBpc24ndCBibG9ja2VkLlxuICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgIGdldEZlYXR1cmVWYWx1ZV9DQUNIRURfTUFZX0JFX1NUQUxFKFxuICAgICAgICAgICAgICAgICAgICAndGVuZ3VfYnJpZGdlX3N5c3RlbV9pbml0JyxcbiAgICAgICAgICAgICAgICAgICAgZmFsc2UsXG4gICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2tpbGxzID0gYXdhaXQgZ2V0U2xhc2hDb21tYW5kVG9vbFNraWxscyhnZXRDd2QoKSlcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoY2FuY2VsbGVkKSByZXR1cm5cbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGF0ZSA9IHN0b3JlLmdldFN0YXRlKClcbiAgICAgICAgICAgICAgICAgICAgICBoYW5kbGVSZWYuY3VycmVudD8ud3JpdGVTZGtNZXNzYWdlcyhbXG4gICAgICAgICAgICAgICAgICAgICAgICBidWlsZFN5c3RlbUluaXRNZXNzYWdlKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdG9vbHMvbWNwQ2xpZW50cy9wbHVnaW5zIHJlZGFjdGVkIGZvciBSRVBMLWJyaWRnZTpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gTUNQLXByZWZpeGVkIHRvb2wgbmFtZXMgYW5kIHNlcnZlciBuYW1lcyBsZWFrIHdoaWNoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGludGVncmF0aW9ucyB0aGUgdXNlciBoYXMgd2lyZWQgdXA7IHBsdWdpbiBwYXRocyBsZWFrXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHJhdyBmaWxlc3lzdGVtIHBhdGhzICh1c2VybmFtZSwgcHJvamVjdCBzdHJ1Y3R1cmUpLlxuICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBDQ1IgdjIgcGVyc2lzdHMgU0RLIG1lc3NhZ2VzIHRvIFNwYW5uZXIg4oCUIHVzZXJzIHdob1xuICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0YXAgXCJDb25uZWN0IGZyb20gcGhvbmVcIiBtYXkgbm90IGV4cGVjdCB0aGVzZSBvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBBbnRocm9waWMncyBzZXJ2ZXJzLiBRdWVyeUVuZ2luZSAoU0RLKSBzdGlsbCBlbWl0c1xuICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBmdWxsIGxpc3RzIOKAlCBTREsgY29uc3VtZXJzIGV4cGVjdCBmdWxsIHRlbGVtZXRyeS5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgdG9vbHM6IFtdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBtY3BDbGllbnRzOiBbXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWw6IG1haW5Mb29wTW9kZWxSZWYuY3VycmVudCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcGVybWlzc2lvbk1vZGU6IHN0YXRlLnRvb2xQZXJtaXNzaW9uQ29udGV4dFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5tb2RlIGFzIFBlcm1pc3Npb25Nb2RlLCAvLyBUT0RPOiBhdm9pZCB0aGUgY2FzdFxuICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBSZW1vdGUgY2xpZW50cyBjYW4gb25seSBpbnZva2UgYnJpZGdlLXNhZmUgY29tbWFuZHMg4oCUXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFkdmVydGlzaW5nIHVuc2FmZSBvbmVzIChsb2NhbC1qc3gsIHVuYWxsb3dlZCBsb2NhbClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gd291bGQgbGV0IG1vYmlsZS93ZWIgYXR0ZW1wdCB0aGVtIGFuZCBoaXQgZXJyb3JzLlxuICAgICAgICAgICAgICAgICAgICAgICAgICBjb21tYW5kczpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21tYW5kc1JlZi5jdXJyZW50LmZpbHRlcihpc0JyaWRnZVNhZmVDb21tYW5kKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYWdlbnRzOiBzdGF0ZS5hZ2VudERlZmluaXRpb25zLmFjdGl2ZUFnZW50cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc2tpbGxzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBwbHVnaW5zOiBbXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZmFzdE1vZGU6IHN0YXRlLmZhc3RNb2RlLFxuICAgICAgICAgICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgICAgICAgXSlcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgbG9nRm9yRGVidWdnaW5nKFxuICAgICAgICAgICAgICAgICAgICAgICAgYFticmlkZ2U6cmVwbF0gRmFpbGVkIHRvIHNlbmQgc3lzdGVtL2luaXQ6ICR7ZXJyb3JNZXNzYWdlKGVycil9YCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgbGV2ZWw6ICdlcnJvcicgfSxcbiAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH0pKClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjYXNlICdyZWNvbm5lY3RpbmcnOlxuICAgICAgICAgICAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4ge1xuICAgICAgICAgICAgICAgICAgaWYgKHByZXYucmVwbEJyaWRnZVJlY29ubmVjdGluZykgcmV0dXJuIHByZXZcbiAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgICAgICAgICAgIHJlcGxCcmlkZ2VSZWNvbm5lY3Rpbmc6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIHJlcGxCcmlkZ2VTZXNzaW9uQWN0aXZlOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgIGNhc2UgJ2ZhaWxlZCc6XG4gICAgICAgICAgICAgICAgLy8gQ2xlYXIgYW55IHByZXZpb3VzIGZhaWx1cmUgZGlzbWlzcyB0aW1lclxuICAgICAgICAgICAgICAgIGNsZWFyVGltZW91dChmYWlsdXJlVGltZW91dFJlZi5jdXJyZW50KVxuICAgICAgICAgICAgICAgIG5vdGlmeUJyaWRnZUZhaWxlZChkZXRhaWwpXG4gICAgICAgICAgICAgICAgc2V0QXBwU3RhdGUocHJldiA9PiAoe1xuICAgICAgICAgICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICAgICAgICAgIHJlcGxCcmlkZ2VFcnJvcjogZGV0YWlsLFxuICAgICAgICAgICAgICAgICAgcmVwbEJyaWRnZVJlY29ubmVjdGluZzogZmFsc2UsXG4gICAgICAgICAgICAgICAgICByZXBsQnJpZGdlU2Vzc2lvbkFjdGl2ZTogZmFsc2UsXG4gICAgICAgICAgICAgICAgICByZXBsQnJpZGdlQ29ubmVjdGVkOiBmYWxzZSxcbiAgICAgICAgICAgICAgICB9KSlcbiAgICAgICAgICAgICAgICAvLyBBdXRvLWRpc2FibGUgYWZ0ZXIgdGltZW91dCBzbyB0aGUgaG9vayBzdG9wcyByZXRyeWluZy5cbiAgICAgICAgICAgICAgICBmYWlsdXJlVGltZW91dFJlZi5jdXJyZW50ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICBpZiAoY2FuY2VsbGVkKSByZXR1cm5cbiAgICAgICAgICAgICAgICAgIGZhaWx1cmVUaW1lb3V0UmVmLmN1cnJlbnQgPSB1bmRlZmluZWRcbiAgICAgICAgICAgICAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXByZXYucmVwbEJyaWRnZUVycm9yKSByZXR1cm4gcHJldlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgICAgICAgICAgICAgcmVwbEJyaWRnZUVuYWJsZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgIHJlcGxCcmlkZ2VFcnJvcjogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH0sIEJSSURHRV9GQUlMVVJFX0RJU01JU1NfTVMpXG4gICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBNYXAgb2YgcGVuZGluZyBicmlkZ2UgcGVybWlzc2lvbiByZXNwb25zZSBoYW5kbGVycywga2V5ZWQgYnkgcmVxdWVzdF9pZC5cbiAgICAgICAgICAvLyBFYWNoIGVudHJ5IGlzIGFuIG9uUmVzcG9uc2UgaGFuZGxlciB3YWl0aW5nIGZvciBDQ1IgdG8gcmVwbHkuXG4gICAgICAgICAgY29uc3QgcGVuZGluZ1Blcm1pc3Npb25IYW5kbGVycyA9IG5ldyBNYXA8XG4gICAgICAgICAgICBzdHJpbmcsXG4gICAgICAgICAgICAocmVzcG9uc2U6IEJyaWRnZVBlcm1pc3Npb25SZXNwb25zZSkgPT4gdm9pZFxuICAgICAgICAgID4oKVxuXG4gICAgICAgICAgLy8gRGlzcGF0Y2ggaW5jb21pbmcgY29udHJvbF9yZXNwb25zZSBtZXNzYWdlcyB0byByZWdpc3RlcmVkIGhhbmRsZXJzXG4gICAgICAgICAgZnVuY3Rpb24gaGFuZGxlUGVybWlzc2lvblJlc3BvbnNlKG1zZzogU0RLQ29udHJvbFJlc3BvbnNlKTogdm9pZCB7XG4gICAgICAgICAgICBjb25zdCByZXF1ZXN0SWQgPSBtc2cucmVzcG9uc2U/LnJlcXVlc3RfaWRcbiAgICAgICAgICAgIGlmICghcmVxdWVzdElkKSByZXR1cm5cbiAgICAgICAgICAgIGNvbnN0IGhhbmRsZXIgPSBwZW5kaW5nUGVybWlzc2lvbkhhbmRsZXJzLmdldChyZXF1ZXN0SWQpXG4gICAgICAgICAgICBpZiAoIWhhbmRsZXIpIHtcbiAgICAgICAgICAgICAgbG9nRm9yRGVidWdnaW5nKFxuICAgICAgICAgICAgICAgIGBbYnJpZGdlOnJlcGxdIE5vIGhhbmRsZXIgZm9yIGNvbnRyb2xfcmVzcG9uc2UgcmVxdWVzdF9pZD0ke3JlcXVlc3RJZH1gLFxuICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcGVuZGluZ1Blcm1pc3Npb25IYW5kbGVycy5kZWxldGUocmVxdWVzdElkKVxuICAgICAgICAgICAgLy8gRXh0cmFjdCB0aGUgcGVybWlzc2lvbiBkZWNpc2lvbiBmcm9tIHRoZSBjb250cm9sX3Jlc3BvbnNlIHBheWxvYWRcbiAgICAgICAgICAgIGNvbnN0IGlubmVyID0gbXNnLnJlc3BvbnNlXG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgIGlubmVyLnN1YnR5cGUgPT09ICdzdWNjZXNzJyAmJlxuICAgICAgICAgICAgICBpbm5lci5yZXNwb25zZSAmJlxuICAgICAgICAgICAgICBpc0JyaWRnZVBlcm1pc3Npb25SZXNwb25zZShpbm5lci5yZXNwb25zZSlcbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICBoYW5kbGVyKGlubmVyLnJlc3BvbnNlKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGhhbmRsZSA9IGF3YWl0IGluaXRSZXBsQnJpZGdlKHtcbiAgICAgICAgICAgIG91dGJvdW5kT25seSxcbiAgICAgICAgICAgIHRhZ3M6IG91dGJvdW5kT25seSA/IFsnY2NyLW1pcnJvciddIDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgb25JbmJvdW5kTWVzc2FnZTogaGFuZGxlSW5ib3VuZE1lc3NhZ2UsXG4gICAgICAgICAgICBvblBlcm1pc3Npb25SZXNwb25zZTogaGFuZGxlUGVybWlzc2lvblJlc3BvbnNlLFxuICAgICAgICAgICAgb25JbnRlcnJ1cHQoKSB7XG4gICAgICAgICAgICAgIGFib3J0Q29udHJvbGxlclJlZi5jdXJyZW50Py5hYm9ydCgpXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgb25TZXRNb2RlbChtb2RlbCkge1xuICAgICAgICAgICAgICBjb25zdCByZXNvbHZlZCA9IG1vZGVsID09PSAnZGVmYXVsdCcgPyBudWxsIDogKG1vZGVsID8/IG51bGwpXG4gICAgICAgICAgICAgIHNldE1haW5Mb29wTW9kZWxPdmVycmlkZShyZXNvbHZlZClcbiAgICAgICAgICAgICAgc2V0QXBwU3RhdGUocHJldiA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHByZXYubWFpbkxvb3BNb2RlbEZvclNlc3Npb24gPT09IHJlc29sdmVkKSByZXR1cm4gcHJldlxuICAgICAgICAgICAgICAgIHJldHVybiB7IC4uLnByZXYsIG1haW5Mb29wTW9kZWxGb3JTZXNzaW9uOiByZXNvbHZlZCB9XG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgb25TZXRNYXhUaGlua2luZ1Rva2VucyhtYXhUb2tlbnMpIHtcbiAgICAgICAgICAgICAgY29uc3QgZW5hYmxlZCA9IG1heFRva2VucyAhPT0gbnVsbFxuICAgICAgICAgICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+IHtcbiAgICAgICAgICAgICAgICBpZiAocHJldi50aGlua2luZ0VuYWJsZWQgPT09IGVuYWJsZWQpIHJldHVybiBwcmV2XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgLi4ucHJldiwgdGhpbmtpbmdFbmFibGVkOiBlbmFibGVkIH1cbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBvblNldFBlcm1pc3Npb25Nb2RlKG1vZGUpIHtcbiAgICAgICAgICAgICAgLy8gUG9saWN5IGd1YXJkcyBNVVNUIGZpcmUgYmVmb3JlIHRyYW5zaXRpb25QZXJtaXNzaW9uTW9kZSDigJRcbiAgICAgICAgICAgICAgLy8gaXRzIGludGVybmFsIGF1dG8tZ2F0ZSBjaGVjayBpcyBhIGRlZmVuc2l2ZSB0aHJvdyAod2l0aCBhXG4gICAgICAgICAgICAgIC8vIHNldEF1dG9Nb2RlQWN0aXZlKHRydWUpIHNpZGUtZWZmZWN0IEJFRk9SRSB0aGUgdGhyb3cpIHJhdGhlclxuICAgICAgICAgICAgICAvLyB0aGFuIGEgZ3JhY2VmdWwgcmVqZWN0LiBMZXR0aW5nIHRoYXQgdGhyb3cgZXNjYXBlIHdvdWxkOlxuICAgICAgICAgICAgICAvLyAoMSkgbGVhdmUgU1RBVEUuYXV0b01vZGVBY3RpdmU9dHJ1ZSB3aGlsZSB0aGUgbW9kZSBpc1xuICAgICAgICAgICAgICAvLyAgICAgdW5jaGFuZ2VkICgzLXdheSBpbnZhcmlhbnQgdmlvbGF0aW9uIHBlciBzcmMvQ0xBVURFLm1kKVxuICAgICAgICAgICAgICAvLyAoMikgZmFpbCB0byBzZW5kIGEgY29udHJvbF9yZXNwb25zZSDihpIgc2VydmVyIGtpbGxzIFdTXG4gICAgICAgICAgICAgIC8vIFRoZXNlIG1pcnJvciBwcmludC50cyBoYW5kbGVTZXRQZXJtaXNzaW9uTW9kZTsgdGhlIGJyaWRnZVxuICAgICAgICAgICAgICAvLyBjYW4ndCBpbXBvcnQgdGhlIGNoZWNrcyBkaXJlY3RseSAoYm9vdHN0cmFwLWlzb2xhdGlvbiksIHNvXG4gICAgICAgICAgICAgIC8vIGl0IHJlbGllcyBvbiB0aGlzIHZlcmRpY3QgdG8gZW1pdCB0aGUgZXJyb3IgcmVzcG9uc2UuXG4gICAgICAgICAgICAgIGlmIChtb2RlID09PSAnYnlwYXNzUGVybWlzc2lvbnMnKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzQnlwYXNzUGVybWlzc2lvbnNNb2RlRGlzYWJsZWQoKSkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgb2s6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBlcnJvcjpcbiAgICAgICAgICAgICAgICAgICAgICAnQ2Fubm90IHNldCBwZXJtaXNzaW9uIG1vZGUgdG8gYnlwYXNzUGVybWlzc2lvbnMgYmVjYXVzZSBpdCBpcyBkaXNhYmxlZCBieSBzZXR0aW5ncyBvciBjb25maWd1cmF0aW9uJyxcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgIXN0b3JlLmdldFN0YXRlKCkudG9vbFBlcm1pc3Npb25Db250ZXh0XG4gICAgICAgICAgICAgICAgICAgIC5pc0J5cGFzc1Blcm1pc3Npb25zTW9kZUF2YWlsYWJsZVxuICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgb2s6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBlcnJvcjpcbiAgICAgICAgICAgICAgICAgICAgICAnQ2Fubm90IHNldCBwZXJtaXNzaW9uIG1vZGUgdG8gYnlwYXNzUGVybWlzc2lvbnMgYmVjYXVzZSB0aGUgc2Vzc2lvbiB3YXMgbm90IGxhdW5jaGVkIHdpdGggLS1kYW5nZXJvdXNseS1za2lwLXBlcm1pc3Npb25zJyxcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgIGZlYXR1cmUoJ1RSQU5TQ1JJUFRfQ0xBU1NJRklFUicpICYmXG4gICAgICAgICAgICAgICAgbW9kZSA9PT0gJ2F1dG8nICYmXG4gICAgICAgICAgICAgICAgIWlzQXV0b01vZGVHYXRlRW5hYmxlZCgpXG4gICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlYXNvbiA9IGdldEF1dG9Nb2RlVW5hdmFpbGFibGVSZWFzb24oKVxuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICBvazogZmFsc2UsXG4gICAgICAgICAgICAgICAgICBlcnJvcjogcmVhc29uXG4gICAgICAgICAgICAgICAgICAgID8gYENhbm5vdCBzZXQgcGVybWlzc2lvbiBtb2RlIHRvIGF1dG86ICR7Z2V0QXV0b01vZGVVbmF2YWlsYWJsZU5vdGlmaWNhdGlvbihyZWFzb24pfWBcbiAgICAgICAgICAgICAgICAgICAgOiAnQ2Fubm90IHNldCBwZXJtaXNzaW9uIG1vZGUgdG8gYXV0bycsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8vIEd1YXJkcyBwYXNzZWQg4oCUIGFwcGx5IHZpYSB0aGUgY2VudHJhbGl6ZWQgdHJhbnNpdGlvbiBzb1xuICAgICAgICAgICAgICAvLyBwcmVQbGFuTW9kZSBzdGFzaGluZyBhbmQgYXV0by1tb2RlIHN0YXRlIHN5bmMgYWxsIGZpcmUuXG4gICAgICAgICAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGN1cnJlbnQgPSBwcmV2LnRvb2xQZXJtaXNzaW9uQ29udGV4dC5tb2RlXG4gICAgICAgICAgICAgICAgaWYgKGN1cnJlbnQgPT09IG1vZGUpIHJldHVybiBwcmV2XG4gICAgICAgICAgICAgICAgY29uc3QgbmV4dCA9IHRyYW5zaXRpb25QZXJtaXNzaW9uTW9kZShcbiAgICAgICAgICAgICAgICAgIGN1cnJlbnQsXG4gICAgICAgICAgICAgICAgICBtb2RlLFxuICAgICAgICAgICAgICAgICAgcHJldi50b29sUGVybWlzc2lvbkNvbnRleHQsXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgICAgICAgICAgdG9vbFBlcm1pc3Npb25Db250ZXh0OiB7IC4uLm5leHQsIG1vZGUgfSxcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIC8vIFJlY2hlY2sgcXVldWVkIHBlcm1pc3Npb24gcHJvbXB0cyBub3cgdGhhdCBtb2RlIGNoYW5nZWQuXG4gICAgICAgICAgICAgIHNldEltbWVkaWF0ZSgoKSA9PiB7XG4gICAgICAgICAgICAgICAgZ2V0TGVhZGVyVG9vbFVzZUNvbmZpcm1RdWV1ZSgpPy4oY3VycmVudFF1ZXVlID0+IHtcbiAgICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZS5mb3JFYWNoKGl0ZW0gPT4ge1xuICAgICAgICAgICAgICAgICAgICB2b2lkIGl0ZW0ucmVjaGVja1Blcm1pc3Npb24oKVxuICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgIHJldHVybiBjdXJyZW50UXVldWVcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICByZXR1cm4geyBvazogdHJ1ZSB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgb25TdGF0ZUNoYW5nZTogaGFuZGxlU3RhdGVDaGFuZ2UsXG4gICAgICAgICAgICBpbml0aWFsTWVzc2FnZXM6IG1lc3NhZ2VzLmxlbmd0aCA+IDAgPyBtZXNzYWdlcyA6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIGdldE1lc3NhZ2VzOiAoKSA9PiBtZXNzYWdlc1JlZi5jdXJyZW50LFxuICAgICAgICAgICAgcHJldmlvdXNseUZsdXNoZWRVVUlEczogZmx1c2hlZFVVSURzUmVmLmN1cnJlbnQsXG4gICAgICAgICAgICBpbml0aWFsTmFtZTogcmVwbEJyaWRnZUluaXRpYWxOYW1lLFxuICAgICAgICAgICAgcGVycGV0dWFsLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgaWYgKGNhbmNlbGxlZCkge1xuICAgICAgICAgICAgLy8gRWZmZWN0IHdhcyBjYW5jZWxsZWQgd2hpbGUgaW5pdFJlcGxCcmlkZ2Ugd2FzIGluIGZsaWdodC5cbiAgICAgICAgICAgIC8vIFRlYXIgZG93biB0aGUgaGFuZGxlIHRvIGF2b2lkIGxlYWtpbmcgcmVzb3VyY2VzIChwb2xsIGxvb3AsXG4gICAgICAgICAgICAvLyBXZWJTb2NrZXQsIHJlZ2lzdGVyZWQgZW52aXJvbm1lbnQsIGNsZWFudXAgY2FsbGJhY2spLlxuICAgICAgICAgICAgbG9nRm9yRGVidWdnaW5nKFxuICAgICAgICAgICAgICBgW2JyaWRnZTpyZXBsXSBIb29rOiBpbml0IGNhbmNlbGxlZCBkdXJpbmcgZmxpZ2h0LCB0ZWFyaW5nIGRvd24ke2hhbmRsZSA/IGAgZW52PSR7aGFuZGxlLmVudmlyb25tZW50SWR9YCA6ICcnfWAsXG4gICAgICAgICAgICApXG4gICAgICAgICAgICBpZiAoaGFuZGxlKSB7XG4gICAgICAgICAgICAgIHZvaWQgaGFuZGxlLnRlYXJkb3duKClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIWhhbmRsZSkge1xuICAgICAgICAgICAgLy8gaW5pdFJlcGxCcmlkZ2UgcmV0dXJuZWQgbnVsbCDigJQgYSBwcmVjb25kaXRpb24gZmFpbGVkLiBGb3IgbW9zdFxuICAgICAgICAgICAgLy8gY2FzZXMgKG5vX29hdXRoLCBwb2xpY3lfZGVuaWVkLCBldGMuKSBvblN0YXRlQ2hhbmdlKCdmYWlsZWQnKVxuICAgICAgICAgICAgLy8gYWxyZWFkeSBmaXJlZCB3aXRoIGEgc3BlY2lmaWMgaGludC4gVGhlIEdyb3d0aEJvb2stZ2F0ZS1vZmYgY2FzZVxuICAgICAgICAgICAgLy8gaXMgaW50ZW50aW9uYWxseSBzaWxlbnQg4oCUIG5vdCBhIGZhaWx1cmUsIGp1c3Qgbm90IHJvbGxlZCBvdXQuXG4gICAgICAgICAgICBjb25zZWN1dGl2ZUZhaWx1cmVzUmVmLmN1cnJlbnQrK1xuICAgICAgICAgICAgbG9nRm9yRGVidWdnaW5nKFxuICAgICAgICAgICAgICBgW2JyaWRnZTpyZXBsXSBJbml0IHJldHVybmVkIG51bGwgKHByZWNvbmRpdGlvbiBvciBzZXNzaW9uIGNyZWF0aW9uIGZhaWxlZCk7IGNvbnNlY3V0aXZlIGZhaWx1cmVzOiAke2NvbnNlY3V0aXZlRmFpbHVyZXNSZWYuY3VycmVudH1gLFxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KGZhaWx1cmVUaW1lb3V0UmVmLmN1cnJlbnQpXG4gICAgICAgICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgICAgIHJlcGxCcmlkZ2VFcnJvcjpcbiAgICAgICAgICAgICAgICBwcmV2LnJlcGxCcmlkZ2VFcnJvciA/PyAnY2hlY2sgZGVidWcgbG9ncyBmb3IgZGV0YWlscycsXG4gICAgICAgICAgICB9KSlcbiAgICAgICAgICAgIGZhaWx1cmVUaW1lb3V0UmVmLmN1cnJlbnQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgaWYgKGNhbmNlbGxlZCkgcmV0dXJuXG4gICAgICAgICAgICAgIGZhaWx1cmVUaW1lb3V0UmVmLmN1cnJlbnQgPSB1bmRlZmluZWRcbiAgICAgICAgICAgICAgc2V0QXBwU3RhdGUocHJldiA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCFwcmV2LnJlcGxCcmlkZ2VFcnJvcikgcmV0dXJuIHByZXZcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICAgICAgICAgIHJlcGxCcmlkZ2VFbmFibGVkOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgIHJlcGxCcmlkZ2VFcnJvcjogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0sIEJSSURHRV9GQUlMVVJFX0RJU01JU1NfTVMpXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICB9XG4gICAgICAgICAgaGFuZGxlUmVmLmN1cnJlbnQgPSBoYW5kbGVcbiAgICAgICAgICBzZXRSZXBsQnJpZGdlSGFuZGxlKGhhbmRsZSlcbiAgICAgICAgICBjb25zZWN1dGl2ZUZhaWx1cmVzUmVmLmN1cnJlbnQgPSAwXG4gICAgICAgICAgLy8gU2tpcCBpbml0aWFsIG1lc3NhZ2VzIGluIHRoZSBmb3J3YXJkaW5nIGVmZmVjdCDigJQgdGhleSB3ZXJlXG4gICAgICAgICAgLy8gYWxyZWFkeSBsb2FkZWQgYXMgc2Vzc2lvbiBldmVudHMgZHVyaW5nIGNyZWF0aW9uLlxuICAgICAgICAgIGxhc3RXcml0dGVuSW5kZXhSZWYuY3VycmVudCA9IGluaXRpYWxNZXNzYWdlQ291bnRcblxuICAgICAgICAgIGlmIChvdXRib3VuZE9ubHkpIHtcbiAgICAgICAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4ge1xuICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgcHJldi5yZXBsQnJpZGdlQ29ubmVjdGVkICYmXG4gICAgICAgICAgICAgICAgcHJldi5yZXBsQnJpZGdlU2Vzc2lvbklkID09PSBoYW5kbGUuYnJpZGdlU2Vzc2lvbklkXG4gICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICByZXR1cm4gcHJldlxuICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgICAgICAgcmVwbEJyaWRnZUNvbm5lY3RlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICByZXBsQnJpZGdlU2Vzc2lvbklkOiBoYW5kbGUuYnJpZGdlU2Vzc2lvbklkLFxuICAgICAgICAgICAgICAgIHJlcGxCcmlkZ2VTZXNzaW9uVXJsOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgcmVwbEJyaWRnZUNvbm5lY3RVcmw6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICByZXBsQnJpZGdlRXJyb3I6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgICAgICAgICAgYFticmlkZ2U6cmVwbF0gTWlycm9yIGluaXRpYWxpemVkLCBzZXNzaW9uPSR7aGFuZGxlLmJyaWRnZVNlc3Npb25JZH1gLFxuICAgICAgICAgICAgKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBCdWlsZCBicmlkZ2UgcGVybWlzc2lvbiBjYWxsYmFja3Mgc28gdGhlIGludGVyYWN0aXZlIHBlcm1pc3Npb25cbiAgICAgICAgICAgIC8vIGhhbmRsZXIgY2FuIHJhY2UgYnJpZGdlIHJlc3BvbnNlcyBhZ2FpbnN0IGxvY2FsIHVzZXIgaW50ZXJhY3Rpb24uXG4gICAgICAgICAgICBjb25zdCBwZXJtaXNzaW9uQ2FsbGJhY2tzOiBCcmlkZ2VQZXJtaXNzaW9uQ2FsbGJhY2tzID0ge1xuICAgICAgICAgICAgICBzZW5kUmVxdWVzdChcbiAgICAgICAgICAgICAgICByZXF1ZXN0SWQsXG4gICAgICAgICAgICAgICAgdG9vbE5hbWUsXG4gICAgICAgICAgICAgICAgaW5wdXQsXG4gICAgICAgICAgICAgICAgdG9vbFVzZUlkLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uLFxuICAgICAgICAgICAgICAgIHBlcm1pc3Npb25TdWdnZXN0aW9ucyxcbiAgICAgICAgICAgICAgICBibG9ja2VkUGF0aCxcbiAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgaGFuZGxlLnNlbmRDb250cm9sUmVxdWVzdCh7XG4gICAgICAgICAgICAgICAgICB0eXBlOiAnY29udHJvbF9yZXF1ZXN0JyxcbiAgICAgICAgICAgICAgICAgIHJlcXVlc3RfaWQ6IHJlcXVlc3RJZCxcbiAgICAgICAgICAgICAgICAgIHJlcXVlc3Q6IHtcbiAgICAgICAgICAgICAgICAgICAgc3VidHlwZTogJ2Nhbl91c2VfdG9vbCcsXG4gICAgICAgICAgICAgICAgICAgIHRvb2xfbmFtZTogdG9vbE5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGlucHV0LFxuICAgICAgICAgICAgICAgICAgICB0b29sX3VzZV9pZDogdG9vbFVzZUlkLFxuICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbixcbiAgICAgICAgICAgICAgICAgICAgLi4uKHBlcm1pc3Npb25TdWdnZXN0aW9uc1xuICAgICAgICAgICAgICAgICAgICAgID8geyBwZXJtaXNzaW9uX3N1Z2dlc3Rpb25zOiBwZXJtaXNzaW9uU3VnZ2VzdGlvbnMgfVxuICAgICAgICAgICAgICAgICAgICAgIDoge30pLFxuICAgICAgICAgICAgICAgICAgICAuLi4oYmxvY2tlZFBhdGggPyB7IGJsb2NrZWRfcGF0aDogYmxvY2tlZFBhdGggfSA6IHt9KSxcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHJlcXVlc3RJZCwgcmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXlsb2FkOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHsgLi4ucmVzcG9uc2UgfVxuICAgICAgICAgICAgICAgIGhhbmRsZS5zZW5kQ29udHJvbFJlc3BvbnNlKHtcbiAgICAgICAgICAgICAgICAgIHR5cGU6ICdjb250cm9sX3Jlc3BvbnNlJyxcbiAgICAgICAgICAgICAgICAgIHJlc3BvbnNlOiB7XG4gICAgICAgICAgICAgICAgICAgIHN1YnR5cGU6ICdzdWNjZXNzJyxcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdF9pZDogcmVxdWVzdElkLFxuICAgICAgICAgICAgICAgICAgICByZXNwb25zZTogcGF5bG9hZCxcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgY2FuY2VsUmVxdWVzdChyZXF1ZXN0SWQpIHtcbiAgICAgICAgICAgICAgICBoYW5kbGUuc2VuZENvbnRyb2xDYW5jZWxSZXF1ZXN0KHJlcXVlc3RJZClcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgb25SZXNwb25zZShyZXF1ZXN0SWQsIGhhbmRsZXIpIHtcbiAgICAgICAgICAgICAgICBwZW5kaW5nUGVybWlzc2lvbkhhbmRsZXJzLnNldChyZXF1ZXN0SWQsIGhhbmRsZXIpXG4gICAgICAgICAgICAgICAgcmV0dXJuICgpID0+IHtcbiAgICAgICAgICAgICAgICAgIHBlbmRpbmdQZXJtaXNzaW9uSGFuZGxlcnMuZGVsZXRlKHJlcXVlc3RJZClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgICAgIHJlcGxCcmlkZ2VQZXJtaXNzaW9uQ2FsbGJhY2tzOiBwZXJtaXNzaW9uQ2FsbGJhY2tzLFxuICAgICAgICAgICAgfSkpXG4gICAgICAgICAgICBjb25zdCB1cmwgPSBnZXRSZW1vdGVTZXNzaW9uVXJsKFxuICAgICAgICAgICAgICBoYW5kbGUuYnJpZGdlU2Vzc2lvbklkLFxuICAgICAgICAgICAgICBoYW5kbGUuc2Vzc2lvbkluZ3Jlc3NVcmwsXG4gICAgICAgICAgICApXG4gICAgICAgICAgICAvLyBlbnZpcm9ubWVudElkID09PSAnJyBzaWduYWxzIHRoZSB2MiBlbnYtbGVzcyBwYXRoLiBidWlsZEJyaWRnZUNvbm5lY3RVcmxcbiAgICAgICAgICAgIC8vIGJ1aWxkcyBhbiBlbnYtc3BlY2lmaWMgY29ubmVjdCBVUkwsIHdoaWNoIGRvZXNuJ3QgZXhpc3Qgd2l0aG91dCBhbiBlbnYuXG4gICAgICAgICAgICBjb25zdCBoYXNFbnYgPSBoYW5kbGUuZW52aXJvbm1lbnRJZCAhPT0gJydcbiAgICAgICAgICAgIGNvbnN0IGNvbm5lY3RVcmwgPSBoYXNFbnZcbiAgICAgICAgICAgICAgPyBidWlsZEJyaWRnZUNvbm5lY3RVcmwoXG4gICAgICAgICAgICAgICAgICBoYW5kbGUuZW52aXJvbm1lbnRJZCxcbiAgICAgICAgICAgICAgICAgIGhhbmRsZS5zZXNzaW9uSW5ncmVzc1VybCxcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgIDogdW5kZWZpbmVkXG4gICAgICAgICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+IHtcbiAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgIHByZXYucmVwbEJyaWRnZUNvbm5lY3RlZCAmJlxuICAgICAgICAgICAgICAgIHByZXYucmVwbEJyaWRnZVNlc3Npb25VcmwgPT09IHVybFxuICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcHJldlxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICAgICAgICByZXBsQnJpZGdlQ29ubmVjdGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgIHJlcGxCcmlkZ2VTZXNzaW9uVXJsOiB1cmwsXG4gICAgICAgICAgICAgICAgcmVwbEJyaWRnZUNvbm5lY3RVcmw6IGNvbm5lY3RVcmwgPz8gcHJldi5yZXBsQnJpZGdlQ29ubmVjdFVybCxcbiAgICAgICAgICAgICAgICByZXBsQnJpZGdlRW52aXJvbm1lbnRJZDogaGFuZGxlLmVudmlyb25tZW50SWQsXG4gICAgICAgICAgICAgICAgcmVwbEJyaWRnZVNlc3Npb25JZDogaGFuZGxlLmJyaWRnZVNlc3Npb25JZCxcbiAgICAgICAgICAgICAgICByZXBsQnJpZGdlRXJyb3I6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgLy8gU2hvdyBicmlkZ2Ugc3RhdHVzIHdpdGggVVJMIGluIHRoZSB0cmFuc2NyaXB0LiBwZXJwZXR1YWwgKEtBSVJPU1xuICAgICAgICAgICAgLy8gYXNzaXN0YW50IG1vZGUpIGZhbGxzIGJhY2sgdG8gdjEgYXQgaW5pdFJlcGxCcmlkZ2UudHMg4oCUIHNraXAgdGhlXG4gICAgICAgICAgICAvLyB2Mi1vbmx5IHVwZ3JhZGUgbnVkZ2UgZm9yIHRoZW0uIE93biB0cnkvY2F0Y2ggc28gYSBjb3NtZXRpY1xuICAgICAgICAgICAgLy8gR3Jvd3RoQm9vayBoaWNjdXAgZG9lc24ndCBoaXQgdGhlIG91dGVyIGluaXQtZmFpbHVyZSBoYW5kbGVyLlxuICAgICAgICAgICAgY29uc3QgdXBncmFkZU51ZGdlID0gIXBlcnBldHVhbFxuICAgICAgICAgICAgICA/IGF3YWl0IHNob3VsZFNob3dBcHBVcGdyYWRlTWVzc2FnZSgpLmNhdGNoKCgpID0+IGZhbHNlKVxuICAgICAgICAgICAgICA6IGZhbHNlXG4gICAgICAgICAgICBpZiAoY2FuY2VsbGVkKSByZXR1cm5cbiAgICAgICAgICAgIHNldE1lc3NhZ2VzKHByZXYgPT4gW1xuICAgICAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgICAgICBjcmVhdGVCcmlkZ2VTdGF0dXNNZXNzYWdlKFxuICAgICAgICAgICAgICAgIHVybCxcbiAgICAgICAgICAgICAgICB1cGdyYWRlTnVkZ2VcbiAgICAgICAgICAgICAgICAgID8gJ1BsZWFzZSB1cGdyYWRlIHRvIHRoZSBsYXRlc3QgdmVyc2lvbiBvZiB0aGUgQ2xhdWRlIG1vYmlsZSBhcHAgdG8gc2VlIHlvdXIgUmVtb3RlIENvbnRyb2wgc2Vzc2lvbnMuJ1xuICAgICAgICAgICAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICksXG4gICAgICAgICAgICBdKVxuXG4gICAgICAgICAgICBsb2dGb3JEZWJ1Z2dpbmcoXG4gICAgICAgICAgICAgIGBbYnJpZGdlOnJlcGxdIEhvb2sgaW5pdGlhbGl6ZWQsIHNlc3Npb249JHtoYW5kbGUuYnJpZGdlU2Vzc2lvbklkfWAsXG4gICAgICAgICAgICApXG4gICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAvLyBOZXZlciBjcmFzaCB0aGUgUkVQTCDigJQgc3VyZmFjZSB0aGUgZXJyb3IgaW4gdGhlIFVJLlxuICAgICAgICAgIC8vIENoZWNrIGNhbmNlbGxlZCBmaXJzdCAoc3ltbWV0cnkgd2l0aCB0aGUgIWhhbmRsZSBwYXRoIGF0IGxpbmUgfjM4Nik6XG4gICAgICAgICAgLy8gaWYgaW5pdFJlcGxCcmlkZ2UgdGhyZXcgZHVyaW5nIHJhcGlkIHRvZ2dsZS1vZmYgKGluLWZsaWdodCBuZXR3b3JrXG4gICAgICAgICAgLy8gZXJyb3IpLCBkb24ndCBjb3VudCB0aGF0IHRvd2FyZCB0aGUgZnVzZSBvciBzcGFtIGEgc3RhbGUgZXJyb3JcbiAgICAgICAgICAvLyBpbnRvIHRoZSBVSS4gQWxzbyBmaXhlcyBwcmUtZXhpc3Rpbmcgc3B1cmlvdXMgc2V0QXBwU3RhdGUvXG4gICAgICAgICAgLy8gc2V0TWVzc2FnZXMgb24gY2FuY2VsbGVkIHRocm93cy5cbiAgICAgICAgICBpZiAoY2FuY2VsbGVkKSByZXR1cm5cbiAgICAgICAgICBjb25zZWN1dGl2ZUZhaWx1cmVzUmVmLmN1cnJlbnQrK1xuICAgICAgICAgIGNvbnN0IGVyck1zZyA9IGVycm9yTWVzc2FnZShlcnIpXG4gICAgICAgICAgbG9nRm9yRGVidWdnaW5nKFxuICAgICAgICAgICAgYFticmlkZ2U6cmVwbF0gSW5pdCBmYWlsZWQ6ICR7ZXJyTXNnfTsgY29uc2VjdXRpdmUgZmFpbHVyZXM6ICR7Y29uc2VjdXRpdmVGYWlsdXJlc1JlZi5jdXJyZW50fWAsXG4gICAgICAgICAgKVxuICAgICAgICAgIGNsZWFyVGltZW91dChmYWlsdXJlVGltZW91dFJlZi5jdXJyZW50KVxuICAgICAgICAgIG5vdGlmeUJyaWRnZUZhaWxlZChlcnJNc2cpXG4gICAgICAgICAgc2V0QXBwU3RhdGUocHJldiA9PiAoe1xuICAgICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICAgIHJlcGxCcmlkZ2VFcnJvcjogZXJyTXNnLFxuICAgICAgICAgIH0pKVxuICAgICAgICAgIGZhaWx1cmVUaW1lb3V0UmVmLmN1cnJlbnQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIGlmIChjYW5jZWxsZWQpIHJldHVyblxuICAgICAgICAgICAgZmFpbHVyZVRpbWVvdXRSZWYuY3VycmVudCA9IHVuZGVmaW5lZFxuICAgICAgICAgICAgc2V0QXBwU3RhdGUocHJldiA9PiB7XG4gICAgICAgICAgICAgIGlmICghcHJldi5yZXBsQnJpZGdlRXJyb3IpIHJldHVybiBwcmV2XG4gICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICAgICAgICByZXBsQnJpZGdlRW5hYmxlZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgcmVwbEJyaWRnZUVycm9yOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfSwgQlJJREdFX0ZBSUxVUkVfRElTTUlTU19NUylcbiAgICAgICAgICBpZiAoIW91dGJvdW5kT25seSkge1xuICAgICAgICAgICAgc2V0TWVzc2FnZXMocHJldiA9PiBbXG4gICAgICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgICAgIGNyZWF0ZVN5c3RlbU1lc3NhZ2UoXG4gICAgICAgICAgICAgICAgYFJlbW90ZSBDb250cm9sIGZhaWxlZCB0byBjb25uZWN0OiAke2Vyck1zZ31gLFxuICAgICAgICAgICAgICAgICd3YXJuaW5nJyxcbiAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIF0pXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KSgpXG5cbiAgICAgIHJldHVybiAoKSA9PiB7XG4gICAgICAgIGNhbmNlbGxlZCA9IHRydWVcbiAgICAgICAgY2xlYXJUaW1lb3V0KGZhaWx1cmVUaW1lb3V0UmVmLmN1cnJlbnQpXG4gICAgICAgIGZhaWx1cmVUaW1lb3V0UmVmLmN1cnJlbnQgPSB1bmRlZmluZWRcbiAgICAgICAgaWYgKGhhbmRsZVJlZi5jdXJyZW50KSB7XG4gICAgICAgICAgbG9nRm9yRGVidWdnaW5nKFxuICAgICAgICAgICAgYFticmlkZ2U6cmVwbF0gSG9vayBjbGVhbnVwOiBzdGFydGluZyB0ZWFyZG93biBmb3IgZW52PSR7aGFuZGxlUmVmLmN1cnJlbnQuZW52aXJvbm1lbnRJZH0gc2Vzc2lvbj0ke2hhbmRsZVJlZi5jdXJyZW50LmJyaWRnZVNlc3Npb25JZH1gLFxuICAgICAgICAgIClcbiAgICAgICAgICB0ZWFyZG93blByb21pc2VSZWYuY3VycmVudCA9IGhhbmRsZVJlZi5jdXJyZW50LnRlYXJkb3duKClcbiAgICAgICAgICBoYW5kbGVSZWYuY3VycmVudCA9IG51bGxcbiAgICAgICAgICBzZXRSZXBsQnJpZGdlSGFuZGxlKG51bGwpXG4gICAgICAgIH1cbiAgICAgICAgc2V0QXBwU3RhdGUocHJldiA9PiB7XG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgIXByZXYucmVwbEJyaWRnZUNvbm5lY3RlZCAmJlxuICAgICAgICAgICAgIXByZXYucmVwbEJyaWRnZVNlc3Npb25BY3RpdmUgJiZcbiAgICAgICAgICAgICFwcmV2LnJlcGxCcmlkZ2VFcnJvclxuICAgICAgICAgICkge1xuICAgICAgICAgICAgcmV0dXJuIHByZXZcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgICByZXBsQnJpZGdlQ29ubmVjdGVkOiBmYWxzZSxcbiAgICAgICAgICAgIHJlcGxCcmlkZ2VTZXNzaW9uQWN0aXZlOiBmYWxzZSxcbiAgICAgICAgICAgIHJlcGxCcmlkZ2VSZWNvbm5lY3Rpbmc6IGZhbHNlLFxuICAgICAgICAgICAgcmVwbEJyaWRnZUNvbm5lY3RVcmw6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHJlcGxCcmlkZ2VTZXNzaW9uVXJsOiB1bmRlZmluZWQsXG4gICAgICAgICAgICByZXBsQnJpZGdlRW52aXJvbm1lbnRJZDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgcmVwbEJyaWRnZVNlc3Npb25JZDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgcmVwbEJyaWRnZUVycm9yOiB1bmRlZmluZWQsXG4gICAgICAgICAgICByZXBsQnJpZGdlUGVybWlzc2lvbkNhbGxiYWNrczogdW5kZWZpbmVkLFxuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgICAgbGFzdFdyaXR0ZW5JbmRleFJlZi5jdXJyZW50ID0gMFxuICAgICAgfVxuICAgIH1cbiAgfSwgW1xuICAgIHJlcGxCcmlkZ2VFbmFibGVkLFxuICAgIHJlcGxCcmlkZ2VPdXRib3VuZE9ubHksXG4gICAgc2V0QXBwU3RhdGUsXG4gICAgc2V0TWVzc2FnZXMsXG4gICAgYWRkTm90aWZpY2F0aW9uLFxuICBdKVxuXG4gIC8vIFdyaXRlIG5ldyBtZXNzYWdlcyBhcyB0aGV5IGFwcGVhci5cbiAgLy8gQWxzbyByZS1ydW5zIHdoZW4gcmVwbEJyaWRnZUNvbm5lY3RlZCBjaGFuZ2VzIChicmlkZ2UgZmluaXNoZXMgaW5pdCksXG4gIC8vIHNvIGFueSBtZXNzYWdlcyB0aGF0IGFycml2ZWQgYmVmb3JlIHRoZSBicmlkZ2Ugd2FzIHJlYWR5IGdldCB3cml0dGVuLlxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIC8vIFBvc2l0aXZlIGZlYXR1cmUoKSBndWFyZCDigJQgc2VlIGZpcnN0IHVzZUVmZmVjdCBjb21tZW50XG4gICAgaWYgKGZlYXR1cmUoJ0JSSURHRV9NT0RFJykpIHtcbiAgICAgIGlmICghcmVwbEJyaWRnZUNvbm5lY3RlZCkgcmV0dXJuXG5cbiAgICAgIGNvbnN0IGhhbmRsZSA9IGhhbmRsZVJlZi5jdXJyZW50XG4gICAgICBpZiAoIWhhbmRsZSkgcmV0dXJuXG5cbiAgICAgIC8vIENsYW1wIHRoZSBpbmRleCBpbiBjYXNlIG1lc3NhZ2VzIHdlcmUgY29tcGFjdGVkIChhcnJheSBzaG9ydGVuZWQpLlxuICAgICAgLy8gQWZ0ZXIgY29tcGFjdGlvbiB0aGUgcmVmIGNvdWxkIGV4Y2VlZCBtZXNzYWdlcy5sZW5ndGgsIGFuZCB3aXRob3V0XG4gICAgICAvLyBjbGFtcGluZyBubyBuZXcgbWVzc2FnZXMgd291bGQgYmUgZm9yd2FyZGVkLlxuICAgICAgaWYgKGxhc3RXcml0dGVuSW5kZXhSZWYuY3VycmVudCA+IG1lc3NhZ2VzLmxlbmd0aCkge1xuICAgICAgICBsb2dGb3JEZWJ1Z2dpbmcoXG4gICAgICAgICAgYFticmlkZ2U6cmVwbF0gQ29tcGFjdGlvbiBkZXRlY3RlZDogbGFzdFdyaXR0ZW5JbmRleD0ke2xhc3RXcml0dGVuSW5kZXhSZWYuY3VycmVudH0gPiBtZXNzYWdlcy5sZW5ndGg9JHttZXNzYWdlcy5sZW5ndGh9LCBjbGFtcGluZ2AsXG4gICAgICAgIClcbiAgICAgIH1cbiAgICAgIGNvbnN0IHN0YXJ0SW5kZXggPSBNYXRoLm1pbihsYXN0V3JpdHRlbkluZGV4UmVmLmN1cnJlbnQsIG1lc3NhZ2VzLmxlbmd0aClcblxuICAgICAgLy8gQ29sbGVjdCBuZXcgbWVzc2FnZXMgc2luY2UgbGFzdCB3cml0ZVxuICAgICAgY29uc3QgbmV3TWVzc2FnZXM6IE1lc3NhZ2VbXSA9IFtdXG4gICAgICBmb3IgKGxldCBpID0gc3RhcnRJbmRleDsgaSA8IG1lc3NhZ2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IG1zZyA9IG1lc3NhZ2VzW2ldXG4gICAgICAgIGlmIChcbiAgICAgICAgICBtc2cgJiZcbiAgICAgICAgICAobXNnLnR5cGUgPT09ICd1c2VyJyB8fFxuICAgICAgICAgICAgbXNnLnR5cGUgPT09ICdhc3Npc3RhbnQnIHx8XG4gICAgICAgICAgICAobXNnLnR5cGUgPT09ICdzeXN0ZW0nICYmIG1zZy5zdWJ0eXBlID09PSAnbG9jYWxfY29tbWFuZCcpKVxuICAgICAgICApIHtcbiAgICAgICAgICBuZXdNZXNzYWdlcy5wdXNoKG1zZylcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGFzdFdyaXR0ZW5JbmRleFJlZi5jdXJyZW50ID0gbWVzc2FnZXMubGVuZ3RoXG5cbiAgICAgIGlmIChuZXdNZXNzYWdlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGhhbmRsZS53cml0ZU1lc3NhZ2VzKG5ld01lc3NhZ2VzKVxuICAgICAgfVxuICAgIH1cbiAgfSwgW21lc3NhZ2VzLCByZXBsQnJpZGdlQ29ubmVjdGVkXSlcblxuICBjb25zdCBzZW5kQnJpZGdlUmVzdWx0ID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIGlmIChmZWF0dXJlKCdCUklER0VfTU9ERScpKSB7XG4gICAgICBoYW5kbGVSZWYuY3VycmVudD8uc2VuZFJlc3VsdCgpXG4gICAgfVxuICB9LCBbXSlcblxuICByZXR1cm4geyBzZW5kQnJpZGdlUmVzdWx0IH1cbn1cbiJdLCJtYXBwaW5ncyI6IkFBQUEsU0FBU0EsT0FBTyxRQUFRLFlBQVk7QUFDcEMsT0FBT0Ms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