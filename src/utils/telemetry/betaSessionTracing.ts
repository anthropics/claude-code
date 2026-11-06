/**
 * Beta Session Tracing for Claude Code
 *
 * This module contains beta tracing features enabled when
 * ENABLE_BETA_TRACING_DETAILED=1 and BETA_TRACING_ENDPOINT are set.
 *
 * For external users, tracing is enabled in SDK/headless mode, or in
 * interactive mode when the org is allowlisted via the
 * tengu_trace_lantern GrowthBook gate.
 * For ant users, tracing is enabled in all modes.
 *
 * Visibility Rules:
 * | Content          | External | Ant  |
 * |------------------|----------|------|
 * | System prompts   | ✅                  | ✅   |
 * | Model output     | ✅                  | ✅   |
 * | Thinking output  | ❌                  | ✅   |
 * | Tools            | ✅                  | ✅   |
 * | new_context      | ✅                  | ✅   |
 *
 * Features:
 * - Per-agent message tracking with hash-based deduplication
 * - System prompt logging (once per unique hash)
 * - Hook execution spans
 * - Detailed new_context attributes for LLM requests
 */

import type { Span } from '@opentelemetry/api'
import { createHash } from 'crypto'
import { getIsNonInteractiveSession } from '../../bootstrap/state.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js'
import { sanitizeToolNameForAnalytics } from '../../services/analytics/metadata.js'
import type { AssistantMessage, UserMessage } from '../../types/message.js'
import { isEnvTruthy } from '../envUtils.js'
import { jsonParse, jsonStringify } from '../slowOperations.js'
import { logOTelEvent } from './events.js'

// Message type for API calls (UserMessage or AssistantMessage)
type APIMessage = UserMessage | AssistantMessage

/**
 * Track hashes we've already logged this session (system prompts, tools, etc).
 *
 * WHY: System prompts and tool schemas are large and rarely change within a session.
 * Sending full content on every request would be wasteful. Instead, we hash and
 * only log the full content once per unique hash.
 */
const seenHashes = new Set<string>()

/**
 * Track the last reported message hash per querySource (agent) for incremental context.
 *
 * WHY: When debugging traces, we want to see what NEW information was added each turn,
 * not the entire conversation history (which can be huge). By tracking the last message
 * we reported per agent, we can compute and send only the delta (new messages since
 * the last request). This is tracked per-agent (querySource) because different agents
 * (main thread, subagents, warmup requests) have independent conversation contexts.
 */
const lastReportedMessageHash = new Map<string, string>()

/**
 * Clear tracking state after compaction.
 * Old hashes are irrelevant once messages have been replaced.
 */
export function clearBetaTracingState(): void {
  seenHashes.clear()
  lastReportedMessageHash.clear()
}

const MAX_CONTENT_SIZE = 60 * 1024 // 60KB (Honeycomb limit is 64KB, staying safe)

/**
 * Check if beta detailed tracing is enabled.
 * - Requires ENABLE_BETA_TRACING_DETAILED=1 and BETA_TRACING_ENDPOINT
 * - For external users, enabled in SDK/headless mode OR when org is
 *   allowlisted via the tengu_trace_lantern GrowthBook gate
 */
export function isBetaTracingEnabled(): boolean {
  const baseEnabled =
    isEnvTruthy(process.env.ENABLE_BETA_TRACING_DETAILED) &&
    Boolean(process.env.BETA_TRACING_ENDPOINT)

  if (!baseEnabled) {
    return false
  }

  // For external users, enable in SDK/headless mode OR when org is allowlisted.
  // Gate reads from disk cache, so first run after allowlisting returns false;
  // works from second run onward (same behavior as enhanced_telemetry_beta).
  if (process.env.USER_TYPE !== 'ant') {
    return (
      getIsNonInteractiveSession() ||
      getFeatureValue_CACHED_MAY_BE_STALE('tengu_trace_lantern', false)
    )
  }

  return true
}

/**
 * Truncate content to fit within Honeycomb limits.
 */
export function truncateContent(
  content: string,
  maxSize: number = MAX_CONTENT_SIZE,
): { content: string; truncated: boolean } {
  if (content.length <= maxSize) {
    return { content, truncated: false }
  }

  return {
    content:
      content.slice(0, maxSize) +
      '\n\n[TRUNCATED - Content exceeds 60KB limit]',
    truncated: true,
  }
}

/**
 * Generate a short hash (first 12 hex chars of SHA-256).
 */
function shortHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 12)
}

/**
 * Generate a hash for a system prompt.
 */
function hashSystemPrompt(systemPrompt: string): string {
  return `sp_${shortHash(systemPrompt)}`
}

/**
 * Generate a hash for a message based on its content.
 */
function hashMessage(message: APIMessage): string {
  const content = jsonStringify(message.message.content)
  return `msg_${shortHash(content)}`
}

// Regex to detect content wrapped in <system-reminder> tags
const SYSTEM_REMINDER_REGEX =
  /^<system-reminder>\n?([\s\S]*?)\n?<\/system-reminder>$/

/**
 * Check if text is entirely a system reminder (wrapped in <system-reminder> tags).
 * Returns the inner content if it is, null otherwise.
 */
function extractSystemReminderContent(text: string): string | null {
  const match = text.trim().match(SYSTEM_REMINDER_REGEX)
  return match && match[1] ? match[1].trim() : null
}

/**
 * Result of formatting messages - separates regular content from system reminders.
 */
interface FormattedMessages {
  contextParts: string[]
  systemReminders: string[]
}

/**
 * Format user messages for new_context display, separating system reminders.
 * Only handles user messages (assistant messages are filtered out before this is called).
 */
function formatMessagesForContext(messages: UserMessage[]): FormattedMessages {
  const contextParts: string[] = []
  const systemReminders: string[] = []

  for (const message of messages) {
    const content = message.message.content
    if (typeof content === 'string') {
      const reminderContent = extractSystemReminderContent(content)
      if (reminderContent) {
        systemReminders.push(reminderContent)
      } else {
        contextParts.push(`[USER]\n${content}`)
      }
    } else if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'text') {
          const reminderContent = extractSystemReminderContent(block.text)
          if (reminderContent) {
            systemReminders.push(reminderContent)
          } else {
            contextParts.push(`[USER]\n${block.text}`)
          }
        } else if (block.type === 'tool_result') {
          const resultContent =
            typeof block.content === 'string'
              ? block.content
              : jsonStringify(block.content)
          // Tool results can also contain system reminders (e.g., malware warning)
          const reminderContent = extractSystemReminderContent(resultContent)
          if (reminderContent) {
            systemReminders.push(reminderContent)
          } else {
            contextParts.push(
              `[TOOL RESULT: ${block.tool_use_id}]\n${resultContent}`,
            )
          }
        }
      }
    }
  }

  return { contextParts, systemReminders }
}

export interface LLMRequestNewContext {
  /** System prompt (typically only on first request or if changed) */
  systemPrompt?: string
  /** Query source identifying the agent/purpose (e.g., 'repl_main_thread', 'agent:builtin') */
  querySource?: string
  /** Tool schemas sent with the request */
  tools?: string
}

/**
 * Add beta attributes to an interaction span.
 * Adds new_context with the user prompt.
 */
export function addBetaInteractionAttributes(
  span: Span,
  userPrompt: string,
): void {
  if (!isBetaTracingEnabled()) {
    return
  }

  const { content: truncatedPrompt, truncated } = truncateContent(
    `[USER PROMPT]\n${userPrompt}`,
  )
  span.setAttributes({
    new_context: truncatedPrompt,
    ...(truncated && {
      new_context_truncated: true,
      new_context_original_length: userPrompt.length,
    }),
  })
}

/**
 * Add beta attributes to an LLM request span.
 * Handles system prompt logging and new_context computation.
 */
export function addBetaLLMRequestAttributes(
  span: Span,
  newContext?: LLMRequestNewContext,
  messagesForAPI?: APIMessage[],
): void {
  if (!isBetaTracingEnabled()) {
    return
  }

  // Add system prompt info to the span
  if (newContext?.systemPrompt) {
    const promptHash = hashSystemPrompt(newContext.systemPrompt)
    const preview = newContext.systemPrompt.slice(0, 500)

    // Always add hash, preview, and length to the span
    span.setAttribute('system_prompt_hash', promptHash)
    span.setAttribute('system_prompt_preview', preview)
    span.setAttribute('system_prompt_length', newContext.systemPrompt.length)

    // Log the full system prompt only once per unique hash this session
    if (!seenHashes.has(promptHash)) {
      seenHashes.add(promptHash)

      // Truncate for the log if needed
      const { content: truncatedPrompt, truncated } = truncateContent(
        newContext.systemPrompt,
      )

      void logOTelEvent('system_prompt', {
        system_prompt_hash: promptHash,
        system_prompt: truncatedPrompt,
        system_prompt_length: String(newContext.systemPrompt.length),
        ...(truncated && { system_prompt_truncated: 'true' }),
      })
    }
  }

  // Add tools info to the span
  if (newContext?.tools) {
    try {
      const toolsArray = jsonParse(newContext.tools) as Record<
        string,
        unknown
      >[]

      // Build array of {name, hash} for each tool
      const toolsWithHashes = toolsArray.map(tool => {
        const toolJson = jsonStringify(tool)
        const toolHash = shortHash(toolJson)
        return {
          name: typeof tool.name === 'string' ? tool.name : 'unknown',
          hash: toolHash,
          json: toolJson,
        }
      })

      // Set span attribute with array of name/hash pairs
      span.setAttribute(
        'tools',
        jsonStringify(
          toolsWithHashes.map(({ name, hash }) => ({ name, hash })),
        ),
      )
      span.setAttribute('tools_count', toolsWithHashes.length)

      // Log each tool's full description once per unique hash
      for (const { name, hash, json } of toolsWithHashes) {
        if (!seenHashes.has(`tool_${hash}`)) {
          seenHashes.add(`tool_${hash}`)

          const { content: truncatedTool, truncated } = truncateContent(json)

          void logOTelEvent('tool', {
            tool_name: sanitizeToolNameForAnalytics(name),
            tool_hash: hash,
            tool: truncatedTool,
            ...(truncated && { tool_truncated: 'true' }),
          })
        }
      }
    } catch {
      // If parsing fails, log the raw tools string
      span.setAttribute('tools_parse_error', true)
    }
  }

  // Add new_context using hash-based tracking (visible to all users)
  if (messagesForAPI && messagesForAPI.length > 0 && newContext?.querySource) {
    const querySource = newContext.querySource
    const lastHash = lastReportedMessageHash.get(querySource)

    // Find where the last reported message is in the array
    let startIndex = 0
    if (lastHash) {
      for (let i = 0; i < messagesForAPI.length; i++) {
        const msg = messagesForAPI[i]
        if (msg && hashMessage(msg) === lastHash) {
          startIndex = i + 1 // Start after the last reported message
          break
        }
      }
      // If lastHash not found, startIndex stays 0 (send everything)
    }

    // Get new messages (filter out assistant messages - we only want user input/tool results)
    const newMessages = messagesForAPI
      .slice(startIndex)
      .filter((m): m is UserMessage => m.type === 'user')

    if (newMessages.length > 0) {
      // Format new messages, separating system reminders from regular content
      const { contextParts, systemReminders } =
        formatMessagesForContext(newMessages)

      // Set new_context (regular user content and tool results)
      if (contextParts.length > 0) {
        const fullContext = contextParts.join('\n\n---\n\n')
        const { content: truncatedContext, truncated } =
          truncateContent(fullContext)

        span.setAttributes({
          new_context: truncatedContext,
          new_context_message_count: newMessages.length,
          ...(truncated && {
            new_context_truncated: true,
            new_context_original_length: fullContext.length,
          }),
        })
      }

      // Set system_reminders as a separate attribute
      if (systemReminders.length > 0) {
        const fullReminders = systemReminders.join('\n\n---\n\n')
        const { content: truncatedReminders, truncated: remindersTruncated } =
          truncateContent(fullReminders)

        span.setAttributes({
          system_reminders: truncatedReminders,
          system_reminders_count: systemReminders.length,
          ...(remindersTruncated && {
            system_reminders_truncated: true,
            system_reminders_original_length: fullReminders.length,
          }),
        })
      }

      // Update last reported hash to the last message in the array
      const lastMessage = messagesForAPI[messagesForAPI.length - 1]
      if (lastMessage) {
        lastReportedMessageHash.set(querySource, hashMessage(lastMessage))
      }
    }
  }
}

/**
 * Add beta attributes to endLLMRequestSpan.
 * Handles model_output and thinking_output truncation.
 */
export function addBetaLLMResponseAttributes(
  endAttributes: Record<string, string | number | boolean>,
  metadata?: {
    modelOutput?: string
    thinkingOutput?: string
  },
): void {
  if (!isBetaTracingEnabled() || !metadata) {
    return
  }

  // Add model_output (text content) - visible to all users
  if (metadata.modelOutput !== undefined) {
    const { content: modelOutput, truncated: outputTruncated } =
      truncateContent(metadata.modelOutput)
    endAttributes['response.model_output'] = modelOutput
    if (outputTruncated) {
      endAttributes['response.model_output_truncated'] = true
      endAttributes['response.model_output_original_length'] =
        metadata.modelOutput.length
    }
  }

  // Add thinking_output - ant-only
  if (
    process.env.USER_TYPE === 'ant' &&
    metadata.thinkingOutput !== undefined
  ) {
    const { content: thinkingOutput, truncated: thinkingTruncated } =
      truncateContent(metadata.thinkingOutput)
    endAttributes['response.thinking_output'] = thinkingOutput
    if (thinkingTruncated) {
      endAttributes['response.thinking_output_truncated'] = true
      endAttributes['response.thinking_output_original_length'] =
        metadata.thinkingOutput.length
    }
  }
}

/**
 * Add beta attributes to startToolSpan.
 * Adds tool_input with the serialized tool input.
 */
export function addBetaToolInputAttributes(
  span: Span,
  toolName: string,
  toolInput: string,
): void {
  if (!isBetaTracingEnabled()) {
    return
  }

  const { content: truncatedInput, truncated } = truncateContent(
    `[TOOL INPUT: ${toolName}]\n${toolInput}`,
  )
  span.setAttributes({
    tool_input: truncatedInput,
    ...(truncated && {
      tool_input_truncated: true,
      tool_input_original_length: toolInput.length,
    }),
  })
}

/**
 * Add beta attributes to endToolSpan.
 * Adds new_context with the tool result.
 */
export function addBetaToolResultAttributes(
  endAttributes: Record<string, string | number | boolean>,
  toolName: string | number | boolean,
  toolResult: string,
): void {
  if (!isBetaTracingEnabled()) {
    return
  }

  const { content: truncatedResult, truncated } = truncateContent(
    `[TOOL RESULT: ${toolName}]\n${toolResult}`,
  )
  endAttributes['new_context'] = truncatedResult
  if (truncated) {
    endAttributes['new_context_truncated'] = true
    endAttributes['new_context_original_length'] = toolResult.length
  }
}
