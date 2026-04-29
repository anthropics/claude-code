/**
 * Session Memory automatically maintains a markdown file with notes about the current conversation.
 * It runs periodically in the background using a forked subagent to extract key information
 * without interrupting the main conversation flow.
 */

import { writeFile } from 'fs/promises'
import memoize from 'lodash-es/memoize.js'
import { getIsRemoteMode } from '../../bootstrap/state.js'
import { getSystemPrompt } from '../../constants/prompts.js'
import { getSystemContext, getUserContext } from '../../context.js'
import type { CanUseToolFn } from '../../hooks/useCanUseTool.js'
import type { Tool, ToolUseContext } from '../../Tool.js'
import { FILE_EDIT_TOOL_NAME } from '../../tools/FileEditTool/constants.js'
import {
  FileReadTool,
  type Output as FileReadToolOutput,
} from '../../tools/FileReadTool/FileReadTool.js'
import type { Message } from '../../types/message.js'
import { count } from '../../utils/array.js'
import {
  createCacheSafeParams,
  createSubagentContext,
  runForkedAgent,
} from '../../utils/forkedAgent.js'
import { getFsImplementation } from '../../utils/fsOperations.js'
import {
  type REPLHookContext,
  registerPostSamplingHook,
} from '../../utils/hooks/postSamplingHooks.js'
import {
  createUserMessage,
  hasToolCallsInLastAssistantTurn,
} from '../../utils/messages.js'
import {
  getSessionMemoryDir,
  getSessionMemoryPath,
} from '../../utils/permissions/filesystem.js'
import { sequential } from '../../utils/sequential.js'
import { asSystemPrompt } from '../../utils/systemPromptType.js'
import { getTokenUsage, tokenCountWithEstimation } from '../../utils/tokens.js'
import { logEvent } from '../analytics/index.js'
import { isAutoCompactEnabled } from '../compact/autoCompact.js'
import {
  buildSessionMemoryUpdatePrompt,
  loadSessionMemoryTemplate,
} from './prompts.js'
import {
  DEFAULT_SESSION_MEMORY_CONFIG,
  getSessionMemoryConfig,
  getToolCallsBetweenUpdates,
  hasMetInitializationThreshold,
  hasMetUpdateThreshold,
  isSessionMemoryInitialized,
  markExtractionCompleted,
  markExtractionStarted,
  markSessionMemoryInitialized,
  recordExtractionTokenCount,
  type SessionMemoryConfig,
  setLastSummarizedMessageId,
  setSessionMemoryConfig,
} from './sessionMemoryUtils.js'

// ============================================================================
// Feature Gate and Config (Cached - Non-blocking)
// ============================================================================
// These functions return cached values from disk immediately without blocking
// on GrowthBook initialization. Values may be stale but are updated in background.

import { errorMessage, getErrnoCode } from '../../utils/errors.js'
import {
  getDynamicConfig_CACHED_MAY_BE_STALE,
  getFeatureValue_CACHED_MAY_BE_STALE,
} from '../analytics/growthbook.js'

/**
 * Check if session memory feature is enabled.
 * Uses cached gate value - returns immediately without blocking.
 */
function isSessionMemoryGateEnabled(): boolean {
  return getFeatureValue_CACHED_MAY_BE_STALE('tengu_session_memory', false)
}

/**
 * Get session memory config from cache.
 * Returns immediately without blocking - value may be stale.
 */
function getSessionMemoryRemoteConfig(): Partial<SessionMemoryConfig> {
  return getDynamicConfig_CACHED_MAY_BE_STALE<Partial<SessionMemoryConfig>>(
    'tengu_sm_config',
    {},
  )
}

// ============================================================================
// Module State
// ============================================================================

let lastMemoryMessageUuid: string | undefined

/**
 * Reset the last memory message UUID (for testing)
 */
export function resetLastMemoryMessageUuid(): void {
  lastMemoryMessageUuid = undefined
}

function countToolCallsSince(
  messages: Message[],
  sinceUuid: string | undefined,
): number {
  let toolCallCount = 0
  let foundStart = sinceUuid === null || sinceUuid === undefined

  for (const message of messages) {
    if (!foundStart) {
      if (message.uuid === sinceUuid) {
        foundStart = true
      }
      continue
    }

    if (message.type === 'assistant') {
      const content = message.message.content
      if (Array.isArray(content)) {
        toolCallCount += count(content, block => block.type === 'tool_use')
      }
    }
  }

  return toolCallCount
}

export function shouldExtractMemory(messages: Message[]): boolean {
  // Check if we've met the initialization threshold
  // Uses total context window tokens (same as autocompact) for consistent behavior
  const currentTokenCount = tokenCountWithEstimation(messages)
  if (!isSessionMemoryInitialized()) {
    if (!hasMetInitializationThreshold(currentTokenCount)) {
      return false
    }
    markSessionMemoryInitialized()
  }

  // Check if we've met the minimum tokens between updates threshold
  // Uses context window growth since last extraction (same metric as init threshold)
  const hasMetTokenThreshold = hasMetUpdateThreshold(currentTokenCount)

  // Check if we've met the tool calls threshold
  const toolCallsSinceLastUpdate = countToolCallsSince(
    messages,
    lastMemoryMessageUuid,
  )
  const hasMetToolCallThreshold =
    toolCallsSinceLastUpdate >= getToolCallsBetweenUpdates()

  // Check if the last assistant turn has no tool calls (safe to extract)
  const hasToolCallsInLastTurn = hasToolCallsInLastAssistantTurn(messages)

  // Trigger extraction when:
  // 1. Both thresholds are met (tokens AND tool calls), OR
  // 2. No tool calls in last turn AND token threshold is met
  //    (to ensure we extract at natural conversation breaks)
  //
  // IMPORTANT: The token threshold (minimumTokensBetweenUpdate) is ALWAYS required.
  // Even if the tool call threshold is met, extraction won't happen until the
  // token threshold is also satisfied. This prevents excessive extractions.
  const shouldExtract =
    (hasMetTokenThreshold && hasMetToolCallThreshold) ||
    (hasMetTokenThreshold && !hasToolCallsInLastTurn)

  if (shouldExtract) {
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.uuid) {
      lastMemoryMessageUuid = lastMessage.uuid
    }
    return true
  }

  return false
}

async function setupSessionMemoryFile(
  toolUseContext: ToolUseContext,
): Promise<{ memoryPath: string; currentMemory: string }> {
  const fs = getFsImplementation()

  // Set up directory and file
  const sessionMemoryDir = getSessionMemoryDir()
  await fs.mkdir(sessionMemoryDir, { mode: 0o700 })

  const memoryPath = getSessionMemoryPath()

  // Create the memory file if it doesn't exist (wx = O_CREAT|O_EXCL)
  try {
    await writeFile(memoryPath, '', {
      encoding: 'utf-8',
      mode: 0o600,
      flag: 'wx',
    })
    // Only load template if file was just created
    const template = await loadSessionMemoryTemplate()
    await writeFile(memoryPath, template, {
      encoding: 'utf-8',
      mode: 0o600,
    })
  } catch (e: unknown) {
    const code = getErrnoCode(e)
    if (code !== 'EEXIST') {
      throw e
    }
  }

  // Drop any cached entry so FileReadTool's dedup doesn't return a
  // file_unchanged stub — we need the actual content. The Read repopulates it.
  toolUseContext.readFileState.delete(memoryPath)
  const result = await FileReadTool.call(
    { file_path: memoryPath },
    toolUseContext,
  )
  let currentMemory = ''

  const output = result.data as FileReadToolOutput
  if (output.type === 'text') {
    currentMemory = output.file.content
  }

  logEvent('tengu_session_memory_file_read', {
    content_length: currentMemory.length,
  })

  return { memoryPath, currentMemory }
}

/**
 * Initialize session memory config from remote config (lazy initialization).
 * Memoized - only runs once per session, subsequent calls return immediately.
 * Uses cached config values - non-blocking.
 */
const initSessionMemoryConfigIfNeeded = memoize((): void => {
  // Load config from cache (non-blocking, may be stale)
  const remoteConfig = getSessionMemoryRemoteConfig()

  // Only use remote values if they are explicitly set (non-zero positive numbers)
  // This ensures sensible defaults aren't overridden by zero values
  const config: SessionMemoryConfig = {
    minimumMessageTokensToInit:
      remoteConfig.minimumMessageTokensToInit &&
      remoteConfig.minimumMessageTokensToInit > 0
        ? remoteConfig.minimumMessageTokensToInit
        : DEFAULT_SESSION_MEMORY_CONFIG.minimumMessageTokensToInit,
    minimumTokensBetweenUpdate:
      remoteConfig.minimumTokensBetweenUpdate &&
      remoteConfig.minimumTokensBetweenUpdate > 0
        ? remoteConfig.minimumTokensBetweenUpdate
        : DEFAULT_SESSION_MEMORY_CONFIG.minimumTokensBetweenUpdate,
    toolCallsBetweenUpdates:
      remoteConfig.toolCallsBetweenUpdates &&
      remoteConfig.toolCallsBetweenUpdates > 0
        ? remoteConfig.toolCallsBetweenUpdates
        : DEFAULT_SESSION_MEMORY_CONFIG.toolCallsBetweenUpdates,
  }
  setSessionMemoryConfig(config)
})

/**
 * Session memory post-sampling hook that extracts and updates session notes
 */
// Track if we've logged the gate check failure this session (to avoid spam)
let hasLoggedGateFailure = false

const extractSessionMemory = sequential(async function (
  context: REPLHookContext,
): Promise<void> {
  const { messages, toolUseContext, querySource } = context

  // Only run session memory on main REPL thread
  if (querySource !== 'repl_main_thread') {
    // Don't log this - it's expected for subagents, teammates, etc.
    return
  }

  // Check gate lazily when hook runs (cached, non-blocking)
  if (!isSessionMemoryGateEnabled()) {
    // Log gate failure once per session (ant-only)
    if (process.env.USER_TYPE === 'ant' && !hasLoggedGateFailure) {
      hasLoggedGateFailure = true
      logEvent('tengu_session_memory_gate_disabled', {})
    }
    return
  }

  // Initialize config from remote (lazy, only once)
  initSessionMemoryConfigIfNeeded()

  if (!shouldExtractMemory(messages)) {
    return
  }

  markExtractionStarted()

  // Create isolated context for setup to avoid polluting parent's cache
  const setupContext = createSubagentContext(toolUseContext)

  // Set up file system and read current state with isolated context
  const { memoryPath, currentMemory } =
    await setupSessionMemoryFile(setupContext)

  // Create extraction message
  const userPrompt = await buildSessionMemoryUpdatePrompt(
    currentMemory,
    memoryPath,
  )

  // Run session memory extraction using runForkedAgent for prompt caching
  // runForkedAgent creates an isolated context to prevent mutation of parent state
  // Pass setupContext.readFileState so the forked agent can edit the memory file
  await runForkedAgent({
    promptMessages: [createUserMessage({ content: userPrompt })],
    cacheSafeParams: createCacheSafeParams(context),
    canUseTool: createMemoryFileCanUseTool(memoryPath),
    querySource: 'session_memory',
    forkLabel: 'session_memory',
    overrides: { readFileState: setupContext.readFileState },
  })

  // Log extraction event for tracking frequency
  // Use the token usage from the last message in the conversation
  const lastMessage = messages[messages.length - 1]
  const usage = lastMessage ? getTokenUsage(lastMessage) : undefined
  const config = getSessionMemoryConfig()
  logEvent('tengu_session_memory_extraction', {
    input_tokens: usage?.input_tokens,
    output_tokens: usage?.output_tokens,
    cache_read_input_tokens: usage?.cache_read_input_tokens ?? undefined,
    cache_creation_input_tokens:
      usage?.cache_creation_input_tokens ?? undefined,
    config_min_message_tokens_to_init: config.minimumMessageTokensToInit,
    config_min_tokens_between_update: config.minimumTokensBetweenUpdate,
    config_tool_calls_between_updates: config.toolCallsBetweenUpdates,
  })

  // Record the context size at extraction for tracking minimumTokensBetweenUpdate
  recordExtractionTokenCount(tokenCountWithEstimation(messages))

  // Update lastSummarizedMessageId after successful completion
  updateLastSummarizedMessageIdIfSafe(messages)

  markExtractionCompleted()
})

/**
 * Initialize session memory by registering the post-sampling hook.
 * This is synchronous to avoid race conditions during startup.
 * The gate check and config loading happen lazily when the hook runs.
 */
export function initSessionMemory(): void {
  if (getIsRemoteMode()) return
  // Session memory is used for compaction, so respect auto-compact settings
  const autoCompactEnabled = isAutoCompactEnabled()

  // Log initialization state (ant-only to avoid noise in external logs)
  if (process.env.USER_TYPE === 'ant') {
    logEvent('tengu_session_memory_init', {
      auto_compact_enabled: autoCompactEnabled,
    })
  }

  if (!autoCompactEnabled) {
    return
  }

  // Register hook unconditionally - gate check happens lazily when hook runs
  registerPostSamplingHook(extractSessionMemory)
}

export type ManualExtractionResult = {
  success: boolean
  memoryPath?: string
  error?: string
}

/**
 * Manually trigger session memory extraction, bypassing threshold checks.
 * Used by the /summary command.
 */
export async function manuallyExtractSessionMemory(
  messages: Message[],
  toolUseContext: ToolUseContext,
): Promise<ManualExtractionResult> {
  if (messages.length === 0) {
    return { success: false, error: 'No messages to summarize' }
  }
  markExtractionStarted()

  try {
    // Create isolated context for setup to avoid polluting parent's cache
    const setupContext = createSubagentContext(toolUseContext)

    // Set up file system and read current state with isolated context
    const { memoryPath, currentMemory } =
      await setupSessionMemoryFile(setupContext)

    // Create extraction message
    const userPrompt = await buildSessionMemoryUpdatePrompt(
      currentMemory,
      memoryPath,
    )

    // Get system prompt for cache-safe params
    const { tools, mainLoopModel } = toolUseContext.options
    const [rawSystemPrompt, userContext, systemContext] = await Promise.all([
      getSystemPrompt(tools, mainLoopModel),
      getUserContext(),
      getSystemContext(),
    ])
    const systemPrompt = asSystemPrompt(rawSystemPrompt)

    // Run session memory extraction using runForkedAgent
    await runForkedAgent({
      promptMessages: [createUserMessage({ content: userPrompt })],
      cacheSafeParams: {
        systemPrompt,
        userContext,
        systemContext,
        toolUseContext: setupContext,
        forkContextMessages: messages,
      },
      canUseTool: createMemoryFileCanUseTool(memoryPath),
      querySource: 'session_memory',
      forkLabel: 'session_memory_manual',
      overrides: { readFileState: setupContext.readFileState },
    })

    // Log manual extraction event
    logEvent('tengu_session_memory_manual_extraction', {})

    // Record the context size at extraction for tracking minimumTokensBetweenUpdate
    recordExtractionTokenCount(tokenCountWithEstimation(messages))

    // Update lastSummarizedMessageId after successful completion
    updateLastSummarizedMessageIdIfSafe(messages)

    return { success: true, memoryPath }
  } catch (error) {
    return {
      success: false,
      error: errorMessage(error),
    }
  } finally {
    markExtractionCompleted()
  }
}

// Helper functions

/**
 * Creates a canUseTool function that only allows Edit for the exact memory file.
 */
export function createMemoryFileCanUseTool(memoryPath: string): CanUseToolFn {
  return async (tool: Tool, input: unknown) => {
    if (
      tool.name === FILE_EDIT_TOOL_NAME &&
      typeof input === 'object' &&
      input !== null &&
      'file_path' in input
    ) {
      const filePath = input.file_path
      if (typeof filePath === 'string' && filePath === memoryPath) {
        return { behavior: 'allow' as const, updatedInput: input }
      }
    }
    return {
      behavior: 'deny' as const,
      message: `only ${FILE_EDIT_TOOL_NAME} on ${memoryPath} is allowed`,
      decisionReason: {
        type: 'other' as const,
        reason: `only ${FILE_EDIT_TOOL_NAME} on ${memoryPath} is allowed`,
      },
    }
  }
}

/**
 * Updates lastSummarizedMessageId after successful extraction.
 * Only sets it if the last message doesn't have tool calls (to avoid orphaned tool_results).
 */
function updateLastSummarizedMessageIdIfSafe(messages: Message[]): void {
  if (!hasToolCallsInLastAssistantTurn(messages)) {
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.uuid) {
      setLastSummarizedMessageId(lastMessage.uuid)
    }
  }
}
