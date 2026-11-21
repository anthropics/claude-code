/**
 * EXPERIMENT: Session memory compaction
 */

import type { AgentId } from '../../types/ids.js'
import type { HookResultMessage, Message } from '../../types/message.js'
import { logForDebugging } from '../../utils/debug.js'
import { isEnvTruthy } from '../../utils/envUtils.js'
import { errorMessage } from '../../utils/errors.js'
import {
  createCompactBoundaryMessage,
  createUserMessage,
  isCompactBoundaryMessage,
} from '../../utils/messages.js'
import { getMainLoopModel } from '../../utils/model/model.js'
import { getSessionMemoryPath } from '../../utils/permissions/filesystem.js'
import { processSessionStartHooks } from '../../utils/sessionStart.js'
import { getTranscriptPath } from '../../utils/sessionStorage.js'
import { tokenCountFromLastAPIResponse } from '../../utils/tokens.js'
import { extractDiscoveredToolNames } from '../../utils/toolSearch.js'
import {
  getDynamicConfig_BLOCKS_ON_INIT,
  getFeatureValue_CACHED_MAY_BE_STALE,
} from '../analytics/growthbook.js'
import { logEvent } from '../analytics/index.js'
import {
  isSessionMemoryEmpty,
  truncateSessionMemoryForCompact,
} from '../SessionMemory/prompts.js'
import {
  getLastSummarizedMessageId,
  getSessionMemoryContent,
  waitForSessionMemoryExtraction,
} from '../SessionMemory/sessionMemoryUtils.js'
import {
  annotateBoundaryWithPreservedSegment,
  buildPostCompactMessages,
  type CompactionResult,
  createPlanAttachmentIfNeeded,
} from './compact.js'
import { estimateMessageTokens } from './microCompact.js'
import { getCompactUserSummaryMessage } from './prompt.js'

/**
 * Configuration for session memory compaction thresholds
 */
export type SessionMemoryCompactConfig = {
  /** Minimum tokens to preserve after compaction */
  minTokens: number
  /** Minimum number of messages with text blocks to keep */
  minTextBlockMessages: number
  /** Maximum tokens to preserve after compaction (hard cap) */
  maxTokens: number
}

// Default configuration values (exported for use in tests)
export const DEFAULT_SM_COMPACT_CONFIG: SessionMemoryCompactConfig = {
  minTokens: 10_000,
  minTextBlockMessages: 5,
  maxTokens: 40_000,
}

// Current configuration (starts with defaults)
let smCompactConfig: SessionMemoryCompactConfig = {
  ...DEFAULT_SM_COMPACT_CONFIG,
}

// Track whether config has been initialized from remote
let configInitialized = false

/**
 * Set the session memory compact configuration
 */
export function setSessionMemoryCompactConfig(
  config: Partial<SessionMemoryCompactConfig>,
): void {
  smCompactConfig = {
    ...smCompactConfig,
    ...config,
  }
}

/**
 * Get the current session memory compact configuration
 */
export function getSessionMemoryCompactConfig(): SessionMemoryCompactConfig {
  return { ...smCompactConfig }
}

/**
 * Reset config state (useful for testing)
 */
export function resetSessionMemoryCompactConfig(): void {
  smCompactConfig = { ...DEFAULT_SM_COMPACT_CONFIG }
  configInitialized = false
}

/**
 * Initialize configuration from remote config (GrowthBook).
 * Only fetches once per session - subsequent calls return immediately.
 */
async function initSessionMemoryCompactConfig(): Promise<void> {
  if (configInitialized) {
    return
  }
  configInitialized = true

  // Load config from GrowthBook, merging with defaults
  const remoteConfig = await getDynamicConfig_BLOCKS_ON_INIT<
    Partial<SessionMemoryCompactConfig>
  >('tengu_sm_compact_config', {})

  // Only use remote values if they are explicitly set (positive numbers)
  // This ensures sensible defaults aren't overridden by zero values
  const config: SessionMemoryCompactConfig = {
    minTokens:
      remoteConfig.minTokens && remoteConfig.minTokens > 0
        ? remoteConfig.minTokens
        : DEFAULT_SM_COMPACT_CONFIG.minTokens,
    minTextBlockMessages:
      remoteConfig.minTextBlockMessages && remoteConfig.minTextBlockMessages > 0
        ? remoteConfig.minTextBlockMessages
        : DEFAULT_SM_COMPACT_CONFIG.minTextBlockMessages,
    maxTokens:
      remoteConfig.maxTokens && remoteConfig.maxTokens > 0
        ? remoteConfig.maxTokens
        : DEFAULT_SM_COMPACT_CONFIG.maxTokens,
  }
  setSessionMemoryCompactConfig(config)
}

/**
 * Check if a message contains text blocks (text content for user/assistant interaction)
 */
export function hasTextBlocks(message: Message): boolean {
  if (message.type === 'assistant') {
    const content = message.message.content
    return content.some(block => block.type === 'text')
  }
  if (message.type === 'user') {
    const content = message.message.content
    if (typeof content === 'string') {
      return content.length > 0
    }
    if (Array.isArray(content)) {
      return content.some(block => block.type === 'text')
    }
  }
  return false
}

/**
 * Check if a message contains tool_result blocks and return their tool_use_ids
 */
function getToolResultIds(message: Message): string[] {
  if (message.type !== 'user') {
    return []
  }
  const content = message.message.content
  if (!Array.isArray(content)) {
    return []
  }
  const ids: string[] = []
  for (const block of content) {
    if (block.type === 'tool_result') {
      ids.push(block.tool_use_id)
    }
  }
  return ids
}

/**
 * Check if a message contains tool_use blocks with any of the given ids
 */
function hasToolUseWithIds(message: Message, toolUseIds: Set<string>): boolean {
  if (message.type !== 'assistant') {
    return false
  }
  const content = message.message.content
  if (!Array.isArray(content)) {
    return false
  }
  return content.some(
    block => block.type === 'tool_use' && toolUseIds.has(block.id),
  )
}

/**
 * Adjust the start index to ensure we don't split tool_use/tool_result pairs
 * or thinking blocks that share the same message.id with kept assistant messages.
 *
 * If ANY message we're keeping contains tool_result blocks, we need to
 * include the preceding assistant message(s) that contain the matching tool_use blocks.
 *
 * Additionally, if ANY assistant message in the kept range has the same message.id
 * as a preceding assistant message (which may contain thinking blocks), we need to
 * include those messages so they can be properly merged by normalizeMessagesForAPI.
 *
 * This handles the case where streaming yields separate messages per content block
 * (thinking, tool_use, etc.) with the same message.id but different uuids. If the
 * startIndex lands on one of these streaming messages, we need to look at ALL kept
 * messages for tool_results, not just the first one.
 *
 * Example bug scenarios this fixes:
 *
 * Tool pair scenario:
 *   Session storage (before compaction):
 *     Index N:   assistant, message.id: X, content: [thinking]
 *     Index N+1: assistant, message.id: X, content: [tool_use: ORPHAN_ID]
 *     Index N+2: assistant, message.id: X, content: [tool_use: VALID_ID]
 *     Index N+3: user, content: [tool_result: ORPHAN_ID, tool_result: VALID_ID]
 *
 *   If startIndex = N+2:
 *     - Old code: checked only message N+2 for tool_results, found none, returned N+2
 *     - After slicing and normalizeMessagesForAPI merging by message.id:
 *       msg[1]: assistant with [tool_use: VALID_ID]  (ORPHAN tool_use was excluded!)
 *       msg[2]: user with [tool_result: ORPHAN_ID, tool_result: VALID_ID]
 *     - API error: orphan tool_result references non-existent tool_use
 *
 * Thinking block scenario:
 *   Session storage (before compaction):
 *     Index N:   assistant, message.id: X, content: [thinking]
 *     Index N+1: assistant, message.id: X, content: [tool_use: ID]
 *     Index N+2: user, content: [tool_result: ID]
 *
 *   If startIndex = N+1:
 *     - Without this fix: thinking block at N is excluded
 *     - After normalizeMessagesForAPI: thinking block is lost (no message to merge with)
 *
 *   Fixed code: detects that message N+1 has same message.id as N, adjusts to N.
 */
export function adjustIndexToPreserveAPIInvariants(
  messages: Message[],
  startIndex: number,
): number {
  if (startIndex <= 0 || startIndex >= messages.length) {
    return startIndex
  }

  let adjustedIndex = startIndex

  // Step 1: Handle tool_use/tool_result pairs
  // Collect tool_result IDs from ALL messages in the kept range
  const allToolResultIds: string[] = []
  for (let i = startIndex; i < messages.length; i++) {
    allToolResultIds.push(...getToolResultIds(messages[i]!))
  }

  if (allToolResultIds.length > 0) {
    // Collect tool_use IDs already in the kept range
    const toolUseIdsInKeptRange = new Set<string>()
    for (let i = adjustedIndex; i < messages.length; i++) {
      const msg = messages[i]!
      if (msg.type === 'assistant' && Array.isArray(msg.message.content)) {
        for (const block of msg.message.content) {
          if (block.type === 'tool_use') {
            toolUseIdsInKeptRange.add(block.id)
          }
        }
      }
    }

    // Only look for tool_uses that are NOT already in the kept range
    const neededToolUseIds = new Set(
      allToolResultIds.filter(id => !toolUseIdsInKeptRange.has(id)),
    )

    // Find the assistant message(s) with matching tool_use blocks
    for (let i = adjustedIndex - 1; i >= 0 && neededToolUseIds.size > 0; i--) {
      const message = messages[i]!
      if (hasToolUseWithIds(message, neededToolUseIds)) {
        adjustedIndex = i
        // Remove found tool_use_ids from the set
        if (
          message.type === 'assistant' &&
          Array.isArray(message.message.content)
        ) {
          for (const block of message.message.content) {
            if (block.type === 'tool_use' && neededToolUseIds.has(block.id)) {
              neededToolUseIds.delete(block.id)
            }
          }
        }
      }
    }
  }

  // Step 2: Handle thinking blocks that share message.id with kept assistant messages
  // Collect all message.ids from assistant messages in the kept range
  const messageIdsInKeptRange = new Set<string>()
  for (let i = adjustedIndex; i < messages.length; i++) {
    const msg = messages[i]!
    if (msg.type === 'assistant' && msg.message.id) {
      messageIdsInKeptRange.add(msg.message.id)
    }
  }

  // Look backwards for assistant messages with the same message.id that are not in the kept range
  // These may contain thinking blocks that need to be merged by normalizeMessagesForAPI
  for (let i = adjustedIndex - 1; i >= 0; i--) {
    const message = messages[i]!
    if (
      message.type === 'assistant' &&
      message.message.id &&
      messageIdsInKeptRange.has(message.message.id)
    ) {
      // This message has the same message.id as one in the kept range
      // Include it so thinking blocks can be properly merged
      adjustedIndex = i
    }
  }

  return adjustedIndex
}

/**
 * Calculate the starting index for messages to keep after compaction.
 * Starts from lastSummarizedMessageId, then expands backwards to meet minimums:
 * - At least config.minTokens tokens
 * - At least config.minTextBlockMessages messages with text blocks
 * Stops expanding if config.maxTokens is reached.
 * Also ensures tool_use/tool_result pairs are not split.
 */
export function calculateMessagesToKeepIndex(
  messages: Message[],
  lastSummarizedIndex: number,
): number {
  if (messages.length === 0) {
    return 0
  }

  const config = getSessionMemoryCompactConfig()

  // Start from the message after lastSummarizedIndex
  // If lastSummarizedIndex is -1 (not found) or messages.length (no summarized id),
  // we start with no messages kept
  let startIndex =
    lastSummarizedIndex >= 0 ? lastSummarizedIndex + 1 : messages.length

  // Calculate current tokens and text-block message count from startIndex to end
  let totalTokens = 0
  let textBlockMessageCount = 0
  for (let i = startIndex; i < messages.length; i++) {
    const msg = messages[i]!
    totalTokens += estimateMessageTokens([msg])
    if (hasTextBlocks(msg)) {
      textBlockMessageCount++
    }
  }

  // Check if we already hit the max cap
  if (totalTokens >= config.maxTokens) {
    return adjustIndexToPreserveAPIInvariants(messages, startIndex)
  }

  // Check if we already meet both minimums
  if (
    totalTokens >= config.minTokens &&
    textBlockMessageCount >= config.minTextBlockMessages
  ) {
    return adjustIndexToPreserveAPIInvariants(messages, startIndex)
  }

  // Expand backwards until we meet both minimums or hit max cap.
  // Floor at the last boundary: the preserved-segment chain has a disk
  // discontinuity there (att[0]→summary shortcut from dedup-skip), which
  // would let the loader's tail→head walk bypass inner preserved messages
  // and then prune them. Reactive compact already slices at the boundary
  // via getMessagesAfterCompactBoundary; this is the same invariant.
  const idx = messages.findLastIndex(m => isCompactBoundaryMessage(m))
  const floor = idx === -1 ? 0 : idx + 1
  for (let i = startIndex - 1; i >= floor; i--) {
    const msg = messages[i]!
    const msgTokens = estimateMessageTokens([msg])
    totalTokens += msgTokens
    if (hasTextBlocks(msg)) {
      textBlockMessageCount++
    }
    startIndex = i

    // Stop if we hit the max cap
    if (totalTokens >= config.maxTokens) {
      break
    }

    // Stop if we meet both minimums
    if (
      totalTokens >= config.minTokens &&
      textBlockMessageCount >= config.minTextBlockMessages
    ) {
      break
    }
  }

  // Adjust for tool pairs
  return adjustIndexToPreserveAPIInvariants(messages, startIndex)
}

/**
 * Check if we should use session memory for compaction
 * Uses cached gate values to avoid blocking on Statsig initialization
 */
export function shouldUseSessionMemoryCompaction(): boolean {
  // Allow env var override for eval runs and testing
  if (isEnvTruthy(process.env.ENABLE_CLAUDE_CODE_SM_COMPACT)) {
    return true
  }
  if (isEnvTruthy(process.env.DISABLE_CLAUDE_CODE_SM_COMPACT)) {
    return false
  }

  const sessionMemoryFlag = getFeatureValue_CACHED_MAY_BE_STALE(
    'tengu_session_memory',
    false,
  )
  const smCompactFlag = getFeatureValue_CACHED_MAY_BE_STALE(
    'tengu_sm_compact',
    false,
  )
  const shouldUse = sessionMemoryFlag && smCompactFlag

  // Log flag states for debugging (ant-only to avoid noise in external logs)
  if (process.env.USER_TYPE === 'ant') {
    logEvent('tengu_sm_compact_flag_check', {
      tengu_session_memory: sessionMemoryFlag,
      tengu_sm_compact: smCompactFlag,
      should_use: shouldUse,
    })
  }

  return shouldUse
}

/**
 * Create a CompactionResult from session memory
 */
function createCompactionResultFromSessionMemory(
  messages: Message[],
  sessionMemory: string,
  messagesToKeep: Message[],
  hookResults: HookResultMessage[],
  transcriptPath: string,
  agentId?: AgentId,
): CompactionResult {
  const preCompactTokenCount = tokenCountFromLastAPIResponse(messages)

  const boundaryMarker = createCompactBoundaryMessage(
    'auto',
    preCompactTokenCount ?? 0,
    messages[messages.length - 1]?.uuid,
  )
  const preCompactDiscovered = extractDiscoveredToolNames(messages)
  if (preCompactDiscovered.size > 0) {
    boundaryMarker.compactMetadata.preCompactDiscoveredTools = [
      ...preCompactDiscovered,
    ].sort()
  }

  // Truncate oversized sections to prevent session memory from consuming
  // the entire post-compact token budget
  const { truncatedContent, wasTruncated } =
    truncateSessionMemoryForCompact(sessionMemory)

  let summaryContent = getCompactUserSummaryMessage(
    truncatedContent,
    true,
    transcriptPath,
    true,
  )

  if (wasTruncated) {
    const memoryPath = getSessionMemoryPath()
    summaryContent += `\n\nSome session memory sections were truncated for length. The full session memory can be viewed at: ${memoryPath}`
  }

  const summaryMessages = [
    createUserMessage({
      content: summaryContent,
      isCompactSummary: true,
      isVisibleInTranscriptOnly: true,
    }),
  ]

  const planAttachment = createPlanAttachmentIfNeeded(agentId)
  const attachments = planAttachment ? [planAttachment] : []

  return {
    boundaryMarker: annotateBoundaryWithPreservedSegment(
      boundaryMarker,
      summaryMessages[summaryMessages.length - 1]!.uuid,
      messagesToKeep,
    ),
    summaryMessages,
    attachments,
    hookResults,
    messagesToKeep,
    preCompactTokenCount,
    // SM-compact has no compact-API-call, so postCompactTokenCount (kept for
    // event continuity) and truePostCompactTokenCount converge to the same value.
    postCompactTokenCount: estimateMessageTokens(summaryMessages),
    truePostCompactTokenCount: estimateMessageTokens(summaryMessages),
  }
}

/**
 * Try to use session memory for compaction instead of traditional compaction.
 * Returns null if session memory compaction cannot be used.
 *
 * Handles two scenarios:
 * 1. Normal case: lastSummarizedMessageId is set, keep only messages after that ID
 * 2. Resumed session: lastSummarizedMessageId is not set but session memory has content,
 *    keep all messages but use session memory as the summary
 */
export async function trySessionMemoryCompaction(
  messages: Message[],
  agentId?: AgentId,
  autoCompactThreshold?: number,
): Promise<CompactionResult | null> {
  if (!shouldUseSessionMemoryCompaction()) {
    return null
  }

  // Initialize config from remote (only fetches once)
  await initSessionMemoryCompactConfig()

  // Wait for any in-progress session memory extraction to complete (with timeout)
  await waitForSessionMemoryExtraction()

  const lastSummarizedMessageId = getLastSummarizedMessageId()
  const sessionMemory = await getSessionMemoryContent()

  // No session memory file exists at all
  if (!sessionMemory) {
    logEvent('tengu_sm_compact_no_session_memory', {})
    return null
  }

  // Session memory exists but matches the template (no actual content extracted)
  // Fall back to legacy compact behavior
  if (await isSessionMemoryEmpty(sessionMemory)) {
    logEvent('tengu_sm_compact_empty_template', {})
    return null
  }

  try {
    let lastSummarizedIndex: number

    if (lastSummarizedMessageId) {
      // Normal case: we know exactly which messages have been summarized
      lastSummarizedIndex = messages.findIndex(
        msg => msg.uuid === lastSummarizedMessageId,
      )

      if (lastSummarizedIndex === -1) {
        // The summarized message ID doesn't exist in current messages
        // This can happen if messages were modified - fall back to legacy compact
        // since we can't determine the boundary between summarized and unsummarized messages
        logEvent('tengu_sm_compact_summarized_id_not_found', {})
        return null
      }
    } else {
      // Resumed session case: session memory has content but we don't know the boundary
      // Set lastSummarizedIndex to last message so startIndex becomes messages.length (no messages kept initially)
      lastSummarizedIndex = messages.length - 1
      logEvent('tengu_sm_compact_resumed_session', {})
    }

    // Calculate the starting index for messages to keep
    // This starts from lastSummarizedIndex, expands to meet minimums,
    // and adjusts to not split tool_use/tool_result pairs
    const startIndex = calculateMessagesToKeepIndex(
      messages,
      lastSummarizedIndex,
    )
    // Filter out old compact boundary messages from messagesToKeep.
    // After REPL pruning, old boundaries re-yielded from messagesToKeep would
    // trigger an unwanted second prune (isCompactBoundaryMessage returns true),
    // discarding the new boundary and summary.
    const messagesToKeep = messages
      .slice(startIndex)
      .filter(m => !isCompactBoundaryMessage(m))

    // Run session start hooks to restore CLAUDE.md and other context
    const hookResults = await processSessionStartHooks('compact', {
      model: getMainLoopModel(),
    })

    // Get transcript path for the summary message
    const transcriptPath = getTranscriptPath()

    const compactionResult = createCompactionResultFromSessionMemory(
      messages,
      sessionMemory,
      messagesToKeep,
      hookResults,
      transcriptPath,
      agentId,
    )

    const postCompactMessages = buildPostCompactMessages(compactionResult)

    const postCompactTokenCount = estimateMessageTokens(postCompactMessages)

    // Only check threshold if one was provided (for autocompact)
    if (
      autoCompactThreshold !== undefined &&
      postCompactTokenCount >= autoCompactThreshold
    ) {
      logEvent('tengu_sm_compact_threshold_exceeded', {
        postCompactTokenCount,
        autoCompactThreshold,
      })
      return null
    }

    return {
      ...compactionResult,
      postCompactTokenCount,
      truePostCompactTokenCount: postCompactTokenCount,
    }
  } catch (error) {
    // Use logEvent instead of logError since errors here are expected
    // (e.g., file not found, path issues) and shouldn't go to error logs
    logEvent('tengu_sm_compact_error', {})
    if (process.env.USER_TYPE === 'ant') {
      logForDebugging(`Session memory compaction error: ${errorMessage(error)}`)
    }
    return null
  }
}
