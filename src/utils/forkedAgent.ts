/**
 * Helper for running forked agent query loops with usage tracking.
 *
 * This utility ensures forked agents:
 * 1. Share identical cache-critical params with the parent to guarantee prompt cache hits
 * 2. Track full usage metrics across the entire query loop
 * 3. Log metrics via the tengu_fork_agent_query event when complete
 * 4. Isolate mutable state to prevent interference with the main agent loop
 */

import type { UUID } from 'crypto'
import { randomUUID } from 'crypto'
import type { PromptCommand } from '../commands.js'
import type { QuerySource } from '../constants/querySource.js'
import type { CanUseToolFn } from '../hooks/useCanUseTool.js'
import { query } from '../query.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../services/analytics/index.js'
import { accumulateUsage, updateUsage } from '../services/api/claude.js'
import { EMPTY_USAGE, type NonNullableUsage } from '../services/api/logging.js'
import type { ToolUseContext } from '../Tool.js'
import type { AgentDefinition } from '../tools/AgentTool/loadAgentsDir.js'
import type { AgentId } from '../types/ids.js'
import type { Message } from '../types/message.js'
import { createChildAbortController } from './abortController.js'
import { logForDebugging } from './debug.js'
import { cloneFileStateCache } from './fileStateCache.js'
import type { REPLHookContext } from './hooks/postSamplingHooks.js'
import {
  createUserMessage,
  extractTextContent,
  getLastAssistantMessage,
} from './messages.js'
import { createDenialTrackingState } from './permissions/denialTracking.js'
import { parseToolListFromCLI } from './permissions/permissionSetup.js'
import { recordSidechainTranscript } from './sessionStorage.js'
import type { SystemPrompt } from './systemPromptType.js'
import {
  type ContentReplacementState,
  cloneContentReplacementState,
} from './toolResultStorage.js'
import { createAgentId } from './uuid.js'

/**
 * Parameters that must be identical between the fork and parent API requests
 * to share the parent's prompt cache. The Anthropic API cache key is composed of:
 * system prompt, tools, model, messages (prefix), and thinking config.
 *
 * CacheSafeParams carries the first five. Thinking config is derived from the
 * inherited toolUseContext.options.thinkingConfig — but can be inadvertently
 * changed if the fork sets maxOutputTokens, which clamps budget_tokens in
 * claude.ts (but only for older models that do not use adaptive thinking).
 * See the maxOutputTokens doc on ForkedAgentParams.
 */
export type CacheSafeParams = {
  /** System prompt - must match parent for cache hits */
  systemPrompt: SystemPrompt
  /** User context - prepended to messages, affects cache */
  userContext: { [k: string]: string }
  /** System context - appended to system prompt, affects cache */
  systemContext: { [k: string]: string }
  /** Tool use context containing tools, model, and other options */
  toolUseContext: ToolUseContext
  /** Parent context messages for prompt cache sharing */
  forkContextMessages: Message[]
}

// Slot written by handleStopHooks after each turn so post-turn forks
// (promptSuggestion, postTurnSummary, /btw) can share the main loop's
// prompt cache without each caller threading params through.
let lastCacheSafeParams: CacheSafeParams | null = null

export function saveCacheSafeParams(params: CacheSafeParams | null): void {
  lastCacheSafeParams = params
}

export function getLastCacheSafeParams(): CacheSafeParams | null {
  return lastCacheSafeParams
}

export type ForkedAgentParams = {
  /** Messages to start the forked query loop with */
  promptMessages: Message[]
  /** Cache-safe parameters that must match the parent query */
  cacheSafeParams: CacheSafeParams
  /** Permission check function for the forked agent */
  canUseTool: CanUseToolFn
  /** Source identifier for tracking */
  querySource: QuerySource
  /** Label for analytics (e.g., 'session_memory', 'supervisor') */
  forkLabel: string
  /** Optional overrides for the subagent context (e.g., readFileState from setup phase) */
  overrides?: SubagentContextOverrides
  /**
   * Optional cap on output tokens. CAUTION: setting this changes both max_tokens
   * AND budget_tokens (via clamping in claude.ts). If the fork uses cacheSafeParams
   * to share the parent's prompt cache, a different budget_tokens will invalidate
   * the cache — thinking config is part of the cache key. Only set this when cache
   * sharing is not a goal (e.g., compact summaries).
   */
  maxOutputTokens?: number
  /** Optional cap on number of turns (API round-trips) */
  maxTurns?: number
  /** Optional callback invoked for each message as it arrives (for streaming UI) */
  onMessage?: (message: Message) => void
  /** Skip sidechain transcript recording (e.g., for ephemeral work like speculation) */
  skipTranscript?: boolean
  /** Skip writing new prompt cache entries on the last message. For
   *  fire-and-forget forks where no future request will read from this prefix. */
  skipCacheWrite?: boolean
}

export type ForkedAgentResult = {
  /** All messages yielded during the query loop */
  messages: Message[]
  /** Accumulated usage across all API calls in the loop */
  totalUsage: NonNullableUsage
}

/**
 * Creates CacheSafeParams from REPLHookContext.
 * Use this helper when forking from a post-sampling hook context.
 *
 * To override specific fields (e.g., toolUseContext with cloned file state),
 * spread the result and override: `{ ...createCacheSafeParams(context), toolUseContext: clonedContext }`
 *
 * @param context - The REPLHookContext from the post-sampling hook
 */
export function createCacheSafeParams(
  context: REPLHookContext,
): CacheSafeParams {
  return {
    systemPrompt: context.systemPrompt,
    userContext: context.userContext,
    systemContext: context.systemContext,
    toolUseContext: context.toolUseContext,
    forkContextMessages: context.messages,
  }
}

/**
 * Creates a modified getAppState that adds allowed tools to the permission context.
 * This is used by forked skill/command execution to grant tool permissions.
 */
export function createGetAppStateWithAllowedTools(
  baseGetAppState: ToolUseContext['getAppState'],
  allowedTools: string[],
): ToolUseContext['getAppState'] {
  if (allowedTools.length === 0) return baseGetAppState
  return () => {
    const appState = baseGetAppState()
    return {
      ...appState,
      toolPermissionContext: {
        ...appState.toolPermissionContext,
        alwaysAllowRules: {
          ...appState.toolPermissionContext.alwaysAllowRules,
          command: [
            ...new Set([
              ...(appState.toolPermissionContext.alwaysAllowRules.command ||
                []),
              ...allowedTools,
            ]),
          ],
        },
      },
    }
  }
}

/**
 * Result from preparing a forked command context.
 */
export type PreparedForkedContext = {
  /** Skill content with args replaced */
  skillContent: string
  /** Modified getAppState with allowed tools */
  modifiedGetAppState: ToolUseContext['getAppState']
  /** The general-purpose agent to use */
  baseAgent: AgentDefinition
  /** Initial prompt messages */
  promptMessages: Message[]
}

/**
 * Prepares the context for executing a forked command/skill.
 * This handles the common setup that both SkillTool and slash commands need.
 */
export async function prepareForkedCommandContext(
  command: PromptCommand,
  args: string,
  context: ToolUseContext,
): Promise<PreparedForkedContext> {
  // Get skill content with $ARGUMENTS replaced
  const skillPrompt = await command.getPromptForCommand(args, context)
  const skillContent = skillPrompt
    .map(block => (block.type === 'text' ? block.text : ''))
    .join('\n')

  // Parse and prepare allowed tools
  const allowedTools = parseToolListFromCLI(command.allowedTools ?? [])

  // Create modified context with allowed tools
  const modifiedGetAppState = createGetAppStateWithAllowedTools(
    context.getAppState,
    allowedTools,
  )

  // Use command.agent if specified, otherwise 'general-purpose'
  const agentTypeName = command.agent ?? 'general-purpose'
  const agents = context.options.agentDefinitions.activeAgents
  const baseAgent =
    agents.find(a => a.agentType === agentTypeName) ??
    agents.find(a => a.agentType === 'general-purpose') ??
    agents[0]

  if (!baseAgent) {
    throw new Error('No agent available for forked execution')
  }

  // Prepare prompt messages
  const promptMessages = [createUserMessage({ content: skillContent })]

  return {
    skillContent,
    modifiedGetAppState,
    baseAgent,
    promptMessages,
  }
}

/**
 * Extracts result text from agent messages.
 */
export function extractResultText(
  agentMessages: Message[],
  defaultText = 'Execution completed',
): string {
  const lastAssistantMessage = getLastAssistantMessage(agentMessages)
  if (!lastAssistantMessage) return defaultText

  const textContent = extractTextContent(
    lastAssistantMessage.message.content,
    '\n',
  )

  return textContent || defaultText
}

/**
 * Options for creating a subagent context.
 *
 * By default, all mutable state is isolated to prevent interference with the parent.
 * Use these options to:
 * - Override specific fields (e.g., custom options, agentId, messages)
 * - Explicitly opt-in to sharing specific callbacks (for interactive subagents)
 */
export type SubagentContextOverrides = {
  /** Override the options object (e.g., custom tools, model) */
  options?: ToolUseContext['options']
  /** Override the agentId (for subagents with their own ID) */
  agentId?: AgentId
  /** Override the agentType (for subagents with a specific type) */
  agentType?: string
  /** Override the messages array */
  messages?: Message[]
  /** Override the readFileState (e.g., fresh cache instead of clone) */
  readFileState?: ToolUseContext['readFileState']
  /** Override the abortController */
  abortController?: AbortController
  /** Override the getAppState function */
  getAppState?: ToolUseContext['getAppState']

  /**
   * Explicit opt-in to share parent's setAppState callback.
   * Use for interactive subagents that need to update shared state.
   * @default false (isolated no-op)
   */
  shareSetAppState?: boolean
  /**
   * Explicit opt-in to share parent's setResponseLength callback.
   * Use for subagents that contribute to parent's response metrics.
   * @default false (isolated no-op)
   */
  shareSetResponseLength?: boolean
  /**
   * Explicit opt-in to share parent's abortController.
   * Use for interactive subagents that should abort with parent.
   * Note: Only applies if abortController override is not provided.
   * @default false (new controller linked to parent)
   */
  shareAbortController?: boolean
  /** Critical system reminder to re-inject at every user turn */
  criticalSystemReminder_EXPERIMENTAL?: string
  /** When true, canUseTool must always be called even when hooks auto-approve.
   *  Used by speculation for overlay file path rewriting. */
  requireCanUseTool?: boolean
  /** Override replacement state — used by resumeAgentBackground to thread
   * state reconstructed from the resumed sidechain so the same results
   * are re-replaced (prompt cache stability). */
  contentReplacementState?: ContentReplacementState
}

/**
 * Creates an isolated ToolUseContext for subagents.
 *
 * By default, ALL mutable state is isolated to prevent interference:
 * - readFileState: cloned from parent
 * - abortController: new controller linked to parent (parent abort propagates)
 * - getAppState: wrapped to set shouldAvoidPermissionPrompts
 * - All mutation callbacks (setAppState, etc.): no-op
 * - Fresh collections: nestedMemoryAttachmentTriggers, toolDecisions
 *
 * Callers can:
 * - Override specific fields via the overrides parameter
 * - Explicitly opt-in to sharing specific callbacks (shareSetAppState, etc.)
 *
 * @param parentContext - The parent's ToolUseContext to create subagent context from
 * @param overrides - Optional overrides and sharing options
 *
 * @example
 * // Full isolation (for background agents like session memory)
 * const ctx = createSubagentContext(parentContext)
 *
 * @example
 * // Custom options and agentId (for AgentTool async agents)
 * const ctx = createSubagentContext(parentContext, {
 *   options: customOptions,
 *   agentId: newAgentId,
 *   messages: initialMessages,
 * })
 *
 * @example
 * // Interactive subagent that shares some state
 * const ctx = createSubagentContext(parentContext, {
 *   options: customOptions,
 *   agentId: newAgentId,
 *   shareSetAppState: true,
 *   shareSetResponseLength: true,
 *   shareAbortController: true,
 * })
 */
export function createSubagentContext(
  parentContext: ToolUseContext,
  overrides?: SubagentContextOverrides,
): ToolUseContext {
  // Determine abortController: explicit override > share parent's > new child
  const abortController =
    overrides?.abortController ??
    (overrides?.shareAbortController
      ? parentContext.abortController
      : createChildAbortController(parentContext.abortController))

  // Determine getAppState - wrap to set shouldAvoidPermissionPrompts unless sharing abortController
  // (if sharing abortController, it's an interactive agent that CAN show UI)
  const getAppState: ToolUseContext['getAppState'] = overrides?.getAppState
    ? overrides.getAppState
    : overrides?.shareAbortController
      ? parentContext.getAppState
      : () => {
          const state = parentContext.getAppState()
          if (state.toolPermissionContext.shouldAvoidPermissionPrompts) {
            return state
          }
          return {
            ...state,
            toolPermissionContext: {
              ...state.toolPermissionContext,
              shouldAvoidPermissionPrompts: true,
            },
          }
        }

  return {
    // Mutable state - cloned by default to maintain isolation
    // Clone overrides.readFileState if provided, otherwise clone from parent
    readFileState: cloneFileStateCache(
      overrides?.readFileState ?? parentContext.readFileState,
    ),
    nestedMemoryAttachmentTriggers: new Set<string>(),
    loadedNestedMemoryPaths: new Set<string>(),
    dynamicSkillDirTriggers: new Set<string>(),
    // Per-subagent: tracks skills surfaced by discovery for was_discovered telemetry (SkillTool.ts:116)
    discoveredSkillNames: new Set<string>(),
    toolDecisions: undefined,
    // Budget decisions: override > clone of parent > undefined (feature off).
    //
    // Clone by default (not fresh): cache-sharing forks process parent
    // messages containing parent tool_use_ids. A fresh state would see
    // them as unseen and make divergent replacement decisions → wire
    // prefix differs → cache miss. A clone makes identical decisions →
    // cache hit. For non-forking subagents the parent UUIDs never match
    // — clone is a harmless no-op.
    //
    // Override: AgentTool resume (reconstructed from sidechain records)
    // and inProcessRunner (per-teammate persistent loop state).
    contentReplacementState:
      overrides?.contentReplacementState ??
      (parentContext.contentReplacementState
        ? cloneContentReplacementState(parentContext.contentReplacementState)
        : undefined),

    // AbortController
    abortController,

    // AppState access
    getAppState,
    setAppState: overrides?.shareSetAppState
      ? parentContext.setAppState
      : () => {},
    // Task registration/kill must always reach the root store, even when
    // setAppState is a no-op — otherwise async agents' background bash tasks
    // are never registered and never killed (PPID=1 zombie).
    setAppStateForTasks:
      parentContext.setAppStateForTasks ?? parentContext.setAppState,
    // Async subagents whose setAppState is a no-op need local denial tracking
    // so the denial counter actually accumulates across retries.
    localDenialTracking: overrides?.shareSetAppState
      ? parentContext.localDenialTracking
      : createDenialTrackingState(),

    // Mutation callbacks - no-op by default
    setInProgressToolUseIDs: () => {},
    setResponseLength: overrides?.shareSetResponseLength
      ? parentContext.setResponseLength
      : () => {},
    pushApiMetricsEntry: overrides?.shareSetResponseLength
      ? parentContext.pushApiMetricsEntry
      : undefined,
    updateFileHistoryState: () => {},
    // Attribution is scoped and functional (prev => next) — safe to share even
    // when setAppState is stubbed. Concurrent calls compose via React's state queue.
    updateAttributionState: parentContext.updateAttributionState,

    // UI callbacks - undefined for subagents (can't control parent UI)
    addNotification: undefined,
    setToolJSX: undefined,
    setStreamMode: undefined,
    setSDKStatus: undefined,
    openMessageSelector: undefined,

    // Fields that can be overridden or copied from parent
    options: overrides?.options ?? parentContext.options,
    messages: overrides?.messages ?? parentContext.messages,
    // Generate new agentId for subagents (each subagent should have its own ID)
    agentId: overrides?.agentId ?? createAgentId(),
    agentType: overrides?.agentType,

    // Create new query tracking chain for subagent with incremented depth
    queryTracking: {
      chainId: randomUUID(),
      depth: (parentContext.queryTracking?.depth ?? -1) + 1,
    },
    fileReadingLimits: parentContext.fileReadingLimits,
    userModified: parentContext.userModified,
    criticalSystemReminder_EXPERIMENTAL:
      overrides?.criticalSystemReminder_EXPERIMENTAL,
    requireCanUseTool: overrides?.requireCanUseTool,
  }
}

/**
 * Runs a forked agent query loop and tracks cache hit metrics.
 *
 * This function:
 * 1. Uses identical cache-safe params from parent to enable prompt caching
 * 2. Accumulates usage across all query iterations
 * 3. Logs tengu_fork_agent_query with full usage when complete
 *
 * @example
 * ```typescript
 * const result = await runForkedAgent({
 *   promptMessages: [createUserMessage({ content: userPrompt })],
 *   cacheSafeParams: {
 *     systemPrompt,
 *     userContext,
 *     systemContext,
 *     toolUseContext: clonedToolUseContext,
 *     forkContextMessages: messages,
 *   },
 *   canUseTool,
 *   querySource: 'session_memory',
 *   forkLabel: 'session_memory',
 * })
 * ```
 */
export async function runForkedAgent({
  promptMessages,
  cacheSafeParams,
  canUseTool,
  querySource,
  forkLabel,
  overrides,
  maxOutputTokens,
  maxTurns,
  onMessage,
  skipTranscript,
  skipCacheWrite,
}: ForkedAgentParams): Promise<ForkedAgentResult> {
  const startTime = Date.now()
  const outputMessages: Message[] = []
  let totalUsage: NonNullableUsage = { ...EMPTY_USAGE }

  const {
    systemPrompt,
    userContext,
    systemContext,
    toolUseContext,
    forkContextMessages,
  } = cacheSafeParams

  // Create isolated context to prevent mutation of parent state
  const isolatedToolUseContext = createSubagentContext(
    toolUseContext,
    overrides,
  )

  // Do NOT filterIncompleteToolCalls here — it drops the whole assistant on
  // partial tool batches, orphaning the paired results (API 400). Dangling
  // tool_uses are repaired downstream by ensureToolResultPairing in claude.ts,
  // same as the main thread — identical post-repair prefix keeps the cache hit.
  const initialMessages: Message[] = [...forkContextMessages, ...promptMessages]

  // Generate agent ID and record initial messages for transcript
  // When skipTranscript is set, skip agent ID creation and all transcript I/O
  const agentId = skipTranscript ? undefined : createAgentId(forkLabel)
  let lastRecordedUuid: UUID | null = null
  if (agentId) {
    await recordSidechainTranscript(initialMessages, agentId).catch(err =>
      logForDebugging(
        `Forked agent [${forkLabel}] failed to record initial transcript: ${err}`,
      ),
    )
    // Track the last recorded message UUID for parent chain continuity
    lastRecordedUuid =
      initialMessages.length > 0
        ? initialMessages[initialMessages.length - 1]!.uuid
        : null
  }

  // Run the query loop with isolated context (cache-safe params preserved)
  try {
    for await (const message of query({
      messages: initialMessages,
      systemPrompt,
      userContext,
      systemContext,
      canUseTool,
      toolUseContext: isolatedToolUseContext,
      querySource,
      maxOutputTokensOverride: maxOutputTokens,
      maxTurns,
      skipCacheWrite,
    })) {
      // Extract real usage from message_delta stream events (final usage per API call)
      if (message.type === 'stream_event') {
        if (
          'event' in message &&
          message.event?.type === 'message_delta' &&
          message.event.usage
        ) {
          const turnUsage = updateUsage({ ...EMPTY_USAGE }, message.event.usage)
          totalUsage = accumulateUsage(totalUsage, turnUsage)
        }
        continue
      }
      if (message.type === 'stream_request_start') {
        continue
      }

      logForDebugging(
        `Forked agent [${forkLabel}] received message: type=${message.type}`,
      )

      outputMessages.push(message as Message)
      onMessage?.(message as Message)

      // Record transcript for recordable message types (same pattern as runAgent.ts)
      const msg = message as Message
      if (
        agentId &&
        (msg.type === 'assistant' ||
          msg.type === 'user' ||
          msg.type === 'progress')
      ) {
        await recordSidechainTranscript([msg], agentId, lastRecordedUuid).catch(
          err =>
            logForDebugging(
              `Forked agent [${forkLabel}] failed to record transcript: ${err}`,
            ),
        )
        if (msg.type !== 'progress') {
          lastRecordedUuid = msg.uuid
        }
      }
    }
  } finally {
    // Release cloned file state cache memory (same pattern as runAgent.ts)
    isolatedToolUseContext.readFileState.clear()
    // Release the cloned fork context messages
    initialMessages.length = 0
  }

  logForDebugging(
    `Forked agent [${forkLabel}] finished: ${outputMessages.length} messages, types=[${outputMessages.map(m => m.type).join(', ')}], totalUsage: input=${totalUsage.input_tokens} output=${totalUsage.output_tokens} cacheRead=${totalUsage.cache_read_input_tokens} cacheCreate=${totalUsage.cache_creation_input_tokens}`,
  )

  const durationMs = Date.now() - startTime

  // Log the fork query metrics with full NonNullableUsage
  logForkAgentQueryEvent({
    forkLabel,
    querySource,
    durationMs,
    messageCount: outputMessages.length,
    totalUsage,
    queryTracking: toolUseContext.queryTracking,
  })

  return {
    messages: outputMessages,
    totalUsage,
  }
}

/**
 * Logs the tengu_fork_agent_query event with full NonNullableUsage fields.
 */
function logForkAgentQueryEvent({
  forkLabel,
  querySource,
  durationMs,
  messageCount,
  totalUsage,
  queryTracking,
}: {
  forkLabel: string
  querySource: QuerySource
  durationMs: number
  messageCount: number
  totalUsage: NonNullableUsage
  queryTracking?: { chainId: string; depth: number }
}): void {
  // Calculate cache hit rate
  const totalInputTokens =
    totalUsage.input_tokens +
    totalUsage.cache_creation_input_tokens +
    totalUsage.cache_read_input_tokens
  const cacheHitRate =
    totalInputTokens > 0
      ? totalUsage.cache_read_input_tokens / totalInputTokens
      : 0

  logEvent('tengu_fork_agent_query', {
    // Metadata
    forkLabel:
      forkLabel as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    querySource:
      querySource as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    durationMs,
    messageCount,

    // NonNullableUsage fields
    inputTokens: totalUsage.input_tokens,
    outputTokens: totalUsage.output_tokens,
    cacheReadInputTokens: totalUsage.cache_read_input_tokens,
    cacheCreationInputTokens: totalUsage.cache_creation_input_tokens,
    serviceTier:
      totalUsage.service_tier as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    cacheCreationEphemeral1hTokens:
      totalUsage.cache_creation.ephemeral_1h_input_tokens,
    cacheCreationEphemeral5mTokens:
      totalUsage.cache_creation.ephemeral_5m_input_tokens,

    // Derived metrics
    cacheHitRate,

    // Query tracking
    ...(queryTracking
      ? {
          queryChainId:
            queryTracking.chainId as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          queryDepth: queryTracking.depth,
        }
      : {}),
  })
}
