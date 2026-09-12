import { feature } from 'bun:bundle'
import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import type { QuerySource } from '../../constants/querySource.js'
import type { ToolUseContext } from '../../Tool.js'
import { FILE_EDIT_TOOL_NAME } from '../../tools/FileEditTool/constants.js'
import { FILE_READ_TOOL_NAME } from '../../tools/FileReadTool/prompt.js'
import { FILE_WRITE_TOOL_NAME } from '../../tools/FileWriteTool/prompt.js'
import { GLOB_TOOL_NAME } from '../../tools/GlobTool/prompt.js'
import { GREP_TOOL_NAME } from '../../tools/GrepTool/prompt.js'
import { WEB_FETCH_TOOL_NAME } from '../../tools/WebFetchTool/prompt.js'
import { WEB_SEARCH_TOOL_NAME } from '../../tools/WebSearchTool/prompt.js'
import type { Message } from '../../types/message.js'
import { logForDebugging } from '../../utils/debug.js'
import { getMainLoopModel } from '../../utils/model/model.js'
import { SHELL_TOOL_NAMES } from '../../utils/shell/shellToolUtils.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../analytics/index.js'
import { notifyCacheDeletion } from '../api/promptCacheBreakDetection.js'
import { roughTokenCountEstimation } from '../tokenEstimation.js'
import {
  clearCompactWarningSuppression,
  suppressCompactWarning,
} from './compactWarningState.js'
import {
  getTimeBasedMCConfig,
  type TimeBasedMCConfig,
} from './timeBasedMCConfig.js'

// Inline from utils/toolResultStorage.ts — importing that file pulls in
// sessionStorage → utils/messages → services/api/errors, completing a
// circular-deps loop back through this file via promptCacheBreakDetection.
// Drift is caught by a test asserting equality with the source-of-truth.
export const TIME_BASED_MC_CLEARED_MESSAGE = '[Old tool result content cleared]'

const IMAGE_MAX_TOKEN_SIZE = 2000

// Only compact these tools
const COMPACTABLE_TOOLS = new Set<string>([
  FILE_READ_TOOL_NAME,
  ...SHELL_TOOL_NAMES,
  GREP_TOOL_NAME,
  GLOB_TOOL_NAME,
  WEB_SEARCH_TOOL_NAME,
  WEB_FETCH_TOOL_NAME,
  FILE_EDIT_TOOL_NAME,
  FILE_WRITE_TOOL_NAME,
])

// --- Cached microcompact state (ant-only, gated by feature('CACHED_MICROCOMPACT')) ---

// Lazy-initialized cached MC module and state to avoid importing in external builds.
// The imports and state live inside feature() checks for dead code elimination.
let cachedMCModule: typeof import('./cachedMicrocompact.js') | null = null
let cachedMCState: import('./cachedMicrocompact.js').CachedMCState | null = null
let pendingCacheEdits:
  | import('./cachedMicrocompact.js').CacheEditsBlock
  | null = null

async function getCachedMCModule(): Promise<
  typeof import('./cachedMicrocompact.js')
> {
  if (!cachedMCModule) {
    cachedMCModule = await import('./cachedMicrocompact.js')
  }
  return cachedMCModule
}

function ensureCachedMCState(): import('./cachedMicrocompact.js').CachedMCState {
  if (!cachedMCState && cachedMCModule) {
    cachedMCState = cachedMCModule.createCachedMCState()
  }
  if (!cachedMCState) {
    throw new Error(
      'cachedMCState not initialized — getCachedMCModule() must be called first',
    )
  }
  return cachedMCState
}

/**
 * Get new pending cache edits to be included in the next API request.
 * Returns null if there are no new pending edits.
 * Clears the pending state (caller must pin them after insertion).
 */
export function consumePendingCacheEdits():
  | import('./cachedMicrocompact.js').CacheEditsBlock
  | null {
  const edits = pendingCacheEdits
  pendingCacheEdits = null
  return edits
}

/**
 * Get all previously-pinned cache edits that must be re-sent at their
 * original positions for cache hits.
 */
export function getPinnedCacheEdits(): import('./cachedMicrocompact.js').PinnedCacheEdits[] {
  if (!cachedMCState) {
    return []
  }
  return cachedMCState.pinnedEdits
}

/**
 * Pin a new cache_edits block to a specific user message position.
 * Called after inserting new edits so they are re-sent in subsequent calls.
 */
export function pinCacheEdits(
  userMessageIndex: number,
  block: import('./cachedMicrocompact.js').CacheEditsBlock,
): void {
  if (cachedMCState) {
    cachedMCState.pinnedEdits.push({ userMessageIndex, block })
  }
}

/**
 * Marks all registered tools as sent to the API.
 * Called after a successful API response.
 */
export function markToolsSentToAPIState(): void {
  if (cachedMCState && cachedMCModule) {
    cachedMCModule.markToolsSentToAPI(cachedMCState)
  }
}

export function resetMicrocompactState(): void {
  if (cachedMCState && cachedMCModule) {
    cachedMCModule.resetCachedMCState(cachedMCState)
  }
  pendingCacheEdits = null
}

// Helper to calculate tool result tokens
function calculateToolResultTokens(block: ToolResultBlockParam): number {
  if (!block.content) {
    return 0
  }

  if (typeof block.content === 'string') {
    return roughTokenCountEstimation(block.content)
  }

  // Array of TextBlockParam | ImageBlockParam | DocumentBlockParam
  return block.content.reduce((sum, item) => {
    if (item.type === 'text') {
      return sum + roughTokenCountEstimation(item.text)
    } else if (item.type === 'image' || item.type === 'document') {
      // Images/documents are approximately 2000 tokens regardless of format
      return sum + IMAGE_MAX_TOKEN_SIZE
    }
    return sum
  }, 0)
}

/**
 * Estimate token count for messages by extracting text content
 * Used for rough token estimation when we don't have accurate API counts
 * Pads estimate by 4/3 to be conservative since we're approximating
 */
export function estimateMessageTokens(messages: Message[]): number {
  let totalTokens = 0

  for (const message of messages) {
    if (message.type !== 'user' && message.type !== 'assistant') {
      continue
    }

    if (!Array.isArray(message.message.content)) {
      continue
    }

    for (const block of message.message.content) {
      if (block.type === 'text') {
        totalTokens += roughTokenCountEstimation(block.text)
      } else if (block.type === 'tool_result') {
        totalTokens += calculateToolResultTokens(block)
      } else if (block.type === 'image' || block.type === 'document') {
        totalTokens += IMAGE_MAX_TOKEN_SIZE
      } else if (block.type === 'thinking') {
        // Match roughTokenCountEstimationForBlock: count only the thinking
        // text, not the JSON wrapper or signature (signature is metadata,
        // not model-tokenized content).
        totalTokens += roughTokenCountEstimation(block.thinking)
      } else if (block.type === 'redacted_thinking') {
        totalTokens += roughTokenCountEstimation(block.data)
      } else if (block.type === 'tool_use') {
        // Match roughTokenCountEstimationForBlock: count name + input,
        // not the JSON wrapper or id field.
        totalTokens += roughTokenCountEstimation(
          block.name + jsonStringify(block.input ?? {}),
        )
      } else {
        // server_tool_use, web_search_tool_result, etc.
        totalTokens += roughTokenCountEstimation(jsonStringify(block))
      }
    }
  }

  // Pad estimate by 4/3 to be conservative since we're approximating
  return Math.ceil(totalTokens * (4 / 3))
}

export type PendingCacheEdits = {
  trigger: 'auto'
  deletedToolIds: string[]
  // Baseline cumulative cache_deleted_input_tokens from the previous API response,
  // used to compute the per-operation delta (the API value is sticky/cumulative)
  baselineCacheDeletedTokens: number
}

export type MicrocompactResult = {
  messages: Message[]
  compactionInfo?: {
    pendingCacheEdits?: PendingCacheEdits
  }
}

/**
 * Walk messages and collect tool_use IDs whose tool name is in
 * COMPACTABLE_TOOLS, in encounter order. Shared by both microcompact paths.
 */
function collectCompactableToolIds(messages: Message[]): string[] {
  const ids: string[] = []
  for (const message of messages) {
    if (
      message.type === 'assistant' &&
      Array.isArray(message.message.content)
    ) {
      for (const block of message.message.content) {
        if (block.type === 'tool_use' && COMPACTABLE_TOOLS.has(block.name)) {
          ids.push(block.id)
        }
      }
    }
  }
  return ids
}

// Prefix-match because promptCategory.ts sets the querySource to
// 'repl_main_thread:outputStyle:<style>' when a non-default output style
// is active. The bare 'repl_main_thread' is only used for the default style.
// query.ts:350/1451 use the same startsWith pattern; the pre-existing
// cached-MC `=== 'repl_main_thread'` check was a latent bug — users with a
// non-default output style were silently excluded from cached MC.
function isMainThreadSource(querySource: QuerySource | undefined): boolean {
  return !querySource || querySource.startsWith('repl_main_thread')
}

export async function microcompactMessages(
  messages: Message[],
  toolUseContext?: ToolUseContext,
  querySource?: QuerySource,
): Promise<MicrocompactResult> {
  // Clear suppression flag at start of new microcompact attempt
  clearCompactWarningSuppression()

  // Time-based trigger runs first and short-circuits. If the gap since the
  // last assistant message exceeds the threshold, the server cache has expired
  // and the full prefix will be rewritten regardless — so content-clear old
  // tool results now, before the request, to shrink what gets rewritten.
  // Cached MC (cache-editing) is skipped when this fires: editing assumes a
  // warm cache, and we just established it's cold.
  const timeBasedResult = maybeTimeBasedMicrocompact(messages, querySource)
  if (timeBasedResult) {
    return timeBasedResult
  }

  // Only run cached MC for the main thread to prevent forked agents
  // (session_memory, prompt_suggestion, etc.) from registering their
  // tool_results in the global cachedMCState, which would cause the main
  // thread to try deleting tools that don't exist in its own conversation.
  if (feature('CACHED_MICROCOMPACT')) {
    const mod = await getCachedMCModule()
    const model = toolUseContext?.options.mainLoopModel ?? getMainLoopModel()
    if (
      mod.isCachedMicrocompactEnabled() &&
      mod.isModelSupportedForCacheEditing(model) &&
      isMainThreadSource(querySource)
    ) {
      return await cachedMicrocompactPath(messages, querySource)
    }
  }

  // Legacy microcompact path removed — tengu_cache_plum_violet is always true.
  // For contexts where cached microcompact is not available (external builds,
  // non-ant users, unsupported models, sub-agents), no compaction happens here;
  // autocompact handles context pressure instead.
  return { messages }
}

/**
 * Cached microcompact path - uses cache editing API to remove tool results
 * without invalidating the cached prefix.
 *
 * Key differences from regular microcompact:
 * - Does NOT modify local message content (cache_reference and cache_edits are added at API layer)
 * - Uses count-based trigger/keep thresholds from GrowthBook config
 * - Takes precedence over regular microcompact (no disk persistence)
 * - Tracks tool results and queues cache edits for the API layer
 */
async function cachedMicrocompactPath(
  messages: Message[],
  querySource: QuerySource | undefined,
): Promise<MicrocompactResult> {
  const mod = await getCachedMCModule()
  const state = ensureCachedMCState()
  const config = mod.getCachedMCConfig()

  const compactableToolIds = new Set(collectCompactableToolIds(messages))
  // Second pass: register tool results grouped by user message
  for (const message of messages) {
    if (message.type === 'user' && Array.isArray(message.message.content)) {
      const groupIds: string[] = []
      for (const block of message.message.content) {
        if (
          block.type === 'tool_result' &&
          compactableToolIds.has(block.tool_use_id) &&
          !state.registeredTools.has(block.tool_use_id)
        ) {
          mod.registerToolResult(state, block.tool_use_id)
          groupIds.push(block.tool_use_id)
        }
      }
      mod.registerToolMessage(state, groupIds)
    }
  }

  const toolsToDelete = mod.getToolResultsToDelete(state)

  if (toolsToDelete.length > 0) {
    // Create and queue the cache_edits block for the API layer
    const cacheEdits = mod.createCacheEditsBlock(state, toolsToDelete)
    if (cacheEdits) {
      pendingCacheEdits = cacheEdits
    }

    logForDebugging(
      `Cached MC deleting ${toolsToDelete.length} tool(s): ${toolsToDelete.join(', ')}`,
    )

    // Log the event
    logEvent('tengu_cached_microcompact', {
      toolsDeleted: toolsToDelete.length,
      deletedToolIds: toolsToDelete.join(
        ',',
      ) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      activeToolCount: state.toolOrder.length - state.deletedRefs.size,
      triggerType:
        'auto' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      threshold: config.triggerThreshold,
      keepRecent: config.keepRecent,
    })

    // Suppress warning after successful compaction
    suppressCompactWarning()

    // Notify cache break detection that cache reads will legitimately drop
    if (feature('PROMPT_CACHE_BREAK_DETECTION')) {
      // Pass the actual querySource — isMainThreadSource now prefix-matches
      // so output-style variants enter here, and getTrackingKey keys on the
      // full source string, not the 'repl_main_thread' prefix.
      notifyCacheDeletion(querySource ?? 'repl_main_thread')
    }

    // Return messages unchanged - cache_reference and cache_edits are added at API layer
    // Boundary message is deferred until after API response so we can use
    // actual cache_deleted_input_tokens from the API instead of client-side estimates
    // Capture the baseline cumulative cache_deleted_input_tokens from the last
    // assistant message so we can compute a per-operation delta after the API call
    const lastAsst = messages.findLast(m => m.type === 'assistant')
    const baseline =
      lastAsst?.type === 'assistant'
        ? ((
            lastAsst.message.usage as unknown as Record<
              string,
              number | undefined
            >
          )?.cache_deleted_input_tokens ?? 0)
        : 0

    return {
      messages,
      compactionInfo: {
        pendingCacheEdits: {
          trigger: 'auto',
          deletedToolIds: toolsToDelete,
          baselineCacheDeletedTokens: baseline,
        },
      },
    }
  }

  // No compaction needed, return messages unchanged
  return { messages }
}

/**
 * Time-based microcompact: when the gap since the last main-loop assistant
 * message exceeds the configured threshold, content-clear all but the most
 * recent N compactable tool results.
 *
 * Returns null when the trigger doesn't fire (disabled, wrong source, gap
 * under threshold, nothing to clear) — caller falls through to other paths.
 *
 * Unlike cached MC, this mutates message content directly. The cache is cold,
 * so there's no cached prefix to preserve via cache_edits.
 */
/**
 * Check whether the time-based trigger should fire for this request.
 *
 * Returns the measured gap (minutes since last assistant message) when the
 * trigger fires, or null when it doesn't (disabled, wrong source, under
 * threshold, no prior assistant, unparseable timestamp).
 *
 * Extracted so other pre-request paths (e.g. snip force-apply) can consult
 * the same predicate without coupling to the tool-result clearing action.
 */
export function evaluateTimeBasedTrigger(
  messages: Message[],
  querySource: QuerySource | undefined,
): { gapMinutes: number; config: TimeBasedMCConfig } | null {
  const config = getTimeBasedMCConfig()
  // Require an explicit main-thread querySource. isMainThreadSource treats
  // undefined as main-thread (for cached-MC backward-compat), but several
  // callers (/context, /compact, analyzeContext) invoke microcompactMessages
  // without a source for analysis-only purposes — they should not trigger.
  if (!config.enabled || !querySource || !isMainThreadSource(querySource)) {
    return null
  }
  const lastAssistant = messages.findLast(m => m.type === 'assistant')
  if (!lastAssistant) {
    return null
  }
  const gapMinutes =
    (Date.now() - new Date(lastAssistant.timestamp).getTime()) / 60_000
  if (!Number.isFinite(gapMinutes) || gapMinutes < config.gapThresholdMinutes) {
    return null
  }
  return { gapMinutes, config }
}

function maybeTimeBasedMicrocompact(
  messages: Message[],
  querySource: QuerySource | undefined,
): MicrocompactResult | null {
  const trigger = evaluateTimeBasedTrigger(messages, querySource)
  if (!trigger) {
    return null
  }
  const { gapMinutes, config } = trigger

  const compactableIds = collectCompactableToolIds(messages)

  // Floor at 1: slice(-0) returns the full array (paradoxically keeps
  // everything), and clearing ALL results leaves the model with zero working
  // context. Neither degenerate is sensible — always keep at least the last.
  const keepRecent = Math.max(1, config.keepRecent)
  const keepSet = new Set(compactableIds.slice(-keepRecent))
  const clearSet = new Set(compactableIds.filter(id => !keepSet.has(id)))

  if (clearSet.size === 0) {
    return null
  }

  let tokensSaved = 0
  const result: Message[] = messages.map(message => {
    if (message.type !== 'user' || !Array.isArray(message.message.content)) {
      return message
    }
    let touched = false
    const newContent = message.message.content.map(block => {
      if (
        block.type === 'tool_result' &&
        clearSet.has(block.tool_use_id) &&
        block.content !== TIME_BASED_MC_CLEARED_MESSAGE
      ) {
        tokensSaved += calculateToolResultTokens(block)
        touched = true
        return { ...block, content: TIME_BASED_MC_CLEARED_MESSAGE }
      }
      return block
    })
    if (!touched) return message
    return {
      ...message,
      message: { ...message.message, content: newContent },
    }
  })

  if (tokensSaved === 0) {
    return null
  }

  logEvent('tengu_time_based_microcompact', {
    gapMinutes: Math.round(gapMinutes),
    gapThresholdMinutes: config.gapThresholdMinutes,
    toolsCleared: clearSet.size,
    toolsKept: keepSet.size,
    keepRecent: config.keepRecent,
    tokensSaved,
  })

  logForDebugging(
    `[TIME-BASED MC] gap ${Math.round(gapMinutes)}min > ${config.gapThresholdMinutes}min, cleared ${clearSet.size} tool results (~${tokensSaved} tokens), kept last ${keepSet.size}`,
  )

  suppressCompactWarning()
  // Cached-MC state (module-level) holds tool IDs registered on prior turns.
  // We just content-cleared some of those tools AND invalidated the server
  // cache by changing prompt content. If cached-MC runs next turn with the
  // stale state, it would try to cache_edit tools whose server-side entries
  // no longer exist. Reset it.
  resetMicrocompactState()
  // We just changed the prompt content — the next response's cache read will
  // be low, but that's us, not a break. Tell the detector to expect a drop.
  // notifyCacheDeletion (not notifyCompaction) because it's already imported
  // here and achieves the same false-positive suppression — adding the second
  // symbol to the import was flagged by the circular-deps check.
  // Pass the actual querySource: getTrackingKey returns the full source string
  // (e.g. 'repl_main_thread:outputStyle:custom'), not just the prefix.
  if (feature('PROMPT_CACHE_BREAK_DETECTION') && querySource) {
    notifyCacheDeletion(querySource)
  }

  return { messages: result }
}
