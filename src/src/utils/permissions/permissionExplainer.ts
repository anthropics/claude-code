import { z } from 'zod/v4'
import { logEvent } from '../../services/analytics/index.js'
import { sanitizeToolNameForAnalytics } from '../../services/analytics/metadata.js'
import type { AssistantMessage, Message } from '../../types/message.js'
import { getGlobalConfig } from '../config.js'
import { logForDebugging } from '../debug.js'
import { errorMessage } from '../errors.js'
import { lazySchema } from '../lazySchema.js'
import { logError } from '../log.js'
import { getMainLoopModel } from '../model/model.js'
import { sideQuery } from '../sideQuery.js'
import { jsonStringify } from '../slowOperations.js'

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

// Map risk levels to numeric values for analytics
const RISK_LEVEL_NUMERIC: Record<RiskLevel, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
}

// Error type codes for analytics
const ERROR_TYPE_PARSE = 1
const ERROR_TYPE_NETWORK = 2
const ERROR_TYPE_UNKNOWN = 3

export type PermissionExplanation = {
  riskLevel: RiskLevel
  explanation: string
  reasoning: string
  risk: string
}

type GenerateExplanationParams = {
  toolName: string
  toolInput: unknown
  toolDescription?: string
  messages?: Message[]
  signal: AbortSignal
}

const SYSTEM_PROMPT = `Analyze shell commands and explain what they do, why you're running them, and potential risks.`

// Tool definition for forced structured output (no beta required)
const EXPLAIN_COMMAND_TOOL = {
  name: 'explain_command',
  description: 'Provide an explanation of a shell command',
  input_schema: {
    type: 'object' as const,
    properties: {
      explanation: {
        type: 'string',
        description: 'What this command does (1-2 sentences)',
      },
      reasoning: {
        type: 'string',
        description:
          'Why YOU are running this command. Start with "I" - e.g. "I need to check the file contents"',
      },
      risk: {
        type: 'string',
        description: 'What could go wrong, under 15 words',
      },
      riskLevel: {
        type: 'string',
        enum: ['LOW', 'MEDIUM', 'HIGH'],
        description:
          'LOW (safe dev workflows), MEDIUM (recoverable changes), HIGH (dangerous/irreversible)',
      },
    },
    required: ['explanation', 'reasoning', 'risk', 'riskLevel'],
  },
}

// Zod schema for parsing and validating the response
const RiskAssessmentSchema = lazySchema(() =>
  z.object({
    riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    explanation: z.string(),
    reasoning: z.string(),
    risk: z.string(),
  }),
)

function formatToolInput(input: unknown): string {
  if (typeof input === 'string') {
    return input
  }
  try {
    return jsonStringify(input, null, 2)
  } catch {
    return String(input)
  }
}

/**
 * Extract recent conversation context from messages for the explainer.
 * Returns a summary of recent assistant messages to provide context
 * for "why" this command is being run.
 */
function extractConversationContext(
  messages: Message[],
  maxChars = 1000,
): string {
  // Get recent assistant messages (they contain Claude's reasoning)
  const assistantMessages = messages
    .filter((m): m is AssistantMessage => m.type === 'assistant')
    .slice(-3) // Last 3 assistant messages

  const contextParts: string[] = []
  let totalChars = 0

  for (const msg of assistantMessages.reverse()) {
    // Extract text content from assistant message
    const textBlocks = msg.message.content
      .filter(c => c.type === 'text')
      .map(c => ('text' in c ? c.text : ''))
      .join(' ')

    if (textBlocks && totalChars < maxChars) {
      const remaining = maxChars - totalChars
      const truncated =
        textBlocks.length > remaining
          ? textBlocks.slice(0, remaining) + '...'
          : textBlocks
      contextParts.unshift(truncated)
      totalChars += truncated.length
    }
  }

  return contextParts.join('\n\n')
}

/**
 * Check if the permission explainer feature is enabled.
 * Enabled by default; users can opt out via config.
 */
export function isPermissionExplainerEnabled(): boolean {
  return getGlobalConfig().permissionExplainerEnabled !== false
}

/**
 * Generate a permission explanation using Haiku with structured output.
 * Returns null if the feature is disabled, request is aborted, or an error occurs.
 */
export async function generatePermissionExplanation({
  toolName,
  toolInput,
  toolDescription,
  messages,
  signal,
}: GenerateExplanationParams): Promise<PermissionExplanation | null> {
  // Check if feature is enabled
  if (!isPermissionExplainerEnabled()) {
    return null
  }

  const startTime = Date.now()

  try {
    const formattedInput = formatToolInput(toolInput)
    const conversationContext = messages?.length
      ? extractConversationContext(messages)
      : ''

    const userPrompt = `Tool: ${toolName}
${toolDescription ? `Description: ${toolDescription}\n` : ''}
Input:
${formattedInput}
${conversationContext ? `\nRecent conversation context:\n${conversationContext}` : ''}

Explain this command in context.`

    const model = getMainLoopModel()

    // Use sideQuery with forced tool choice for guaranteed structured output
    const response = await sideQuery({
      model,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      tools: [EXPLAIN_COMMAND_TOOL],
      tool_choice: { type: 'tool', name: 'explain_command' },
      signal,
      querySource: 'permission_explainer',
    })

    const latencyMs = Date.now() - startTime
    logForDebugging(
      `Permission explainer: API returned in ${latencyMs}ms, stop_reason=${response.stop_reason}`,
    )

    // Extract structured data from tool use block
    const toolUseBlock = response.content.find(c => c.type === 'tool_use')
    if (toolUseBlock && toolUseBlock.type === 'tool_use') {
      logForDebugging(
        `Permission explainer: tool input: ${jsonStringify(toolUseBlock.input).slice(0, 500)}`,
      )
      const result = RiskAssessmentSchema().safeParse(toolUseBlock.input)

      if (result.success) {
        const explanation: PermissionExplanation = {
          riskLevel: result.data.riskLevel,
          explanation: result.data.explanation,
          reasoning: result.data.reasoning,
          risk: result.data.risk,
        }

        logEvent('tengu_permission_explainer_generated', {
          tool_name: sanitizeToolNameForAnalytics(toolName),
          risk_level: RISK_LEVEL_NUMERIC[explanation.riskLevel],
          latency_ms: latencyMs,
        })
        logForDebugging(
          `Permission explainer: ${explanation.riskLevel} risk for ${toolName} (${latencyMs}ms)`,
        )
        return explanation
      }
    }

    // No valid JSON in response
    logEvent('tengu_permission_explainer_error', {
      tool_name: sanitizeToolNameForAnalytics(toolName),
      error_type: ERROR_TYPE_PARSE,
      latency_ms: latencyMs,
    })
    logForDebugging(`Permission explainer: no parsed output in response`)
    return null
  } catch (error) {
    const latencyMs = Date.now() - startTime

    // Don't log aborted requests as errors
    if (signal.aborted) {
      logForDebugging(`Permission explainer: request aborted for ${toolName}`)
      return null
    }

    logForDebugging(`Permission explainer error: ${errorMessage(error)}`)
    logError(error)
    logEvent('tengu_permission_explainer_error', {
      tool_name: sanitizeToolNameForAnalytics(toolName),
      error_type:
        error instanceof Error && error.name === 'AbortError'
          ? ERROR_TYPE_NETWORK
          : ERROR_TYPE_UNKNOWN,
      latency_ms: latencyMs,
    })
    return null
  }
}
