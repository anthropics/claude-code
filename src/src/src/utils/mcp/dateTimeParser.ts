import { queryHaiku } from '../../services/api/claude.js'
import { logError } from '../log.js'
import { extractTextContent } from '../messages.js'
import { asSystemPrompt } from '../systemPromptType.js'

export type DateTimeParseResult =
  | { success: true; value: string }
  | { success: false; error: string }

/**
 * Parse natural language date/time input into ISO 8601 format using Haiku.
 *
 * Examples:
 * - "tomorrow at 3pm" → "2025-10-15T15:00:00-07:00"
 * - "next Monday" → "2025-10-20"
 * - "in 2 hours" → "2025-10-14T12:30:00-07:00"
 *
 * @param input The natural language date/time string from the user
 * @param format Whether to parse as 'date' (YYYY-MM-DD) or 'date-time' (full ISO 8601 with time)
 * @param signal AbortSignal for cancellation
 * @returns Parsed ISO 8601 string or error message
 */
export async function parseNaturalLanguageDateTime(
  input: string,
  format: 'date' | 'date-time',
  signal: AbortSignal,
): Promise<DateTimeParseResult> {
  // Get current datetime with timezone for context
  const now = new Date()
  const currentDateTime = now.toISOString()
  const timezoneOffset = -now.getTimezoneOffset() // minutes, inverted sign
  const tzHours = Math.floor(Math.abs(timezoneOffset) / 60)
  const tzMinutes = Math.abs(timezoneOffset) % 60
  const tzSign = timezoneOffset >= 0 ? '+' : '-'
  const timezone = `${tzSign}${String(tzHours).padStart(2, '0')}:${String(tzMinutes).padStart(2, '0')}`
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' })

  // Build system prompt with context
  const systemPrompt = asSystemPrompt([
    'You are a date/time parser that converts natural language into ISO 8601 format.',
    'You MUST respond with ONLY the ISO 8601 formatted string, with no explanation or additional text.',
    'If the input is ambiguous, prefer future dates over past dates.',
    "For times without dates, use today's date.",
    'For dates without times, do not include a time component.',
    'If the input is incomplete or you cannot confidently parse it into a valid date, respond with exactly "INVALID" (nothing else).',
    'Examples of INVALID input: partial dates like "2025-01-", lone numbers like "13", gibberish.',
    'Examples of valid natural language: "tomorrow", "next Monday", "jan 1st 2025", "in 2 hours", "yesterday".',
  ])

  // Build user prompt with rich context
  const formatDescription =
    format === 'date'
      ? 'YYYY-MM-DD (date only, no time)'
      : `YYYY-MM-DDTHH:MM:SS${timezone} (full date-time with timezone)`

  const userPrompt = `Current context:
- Current date and time: ${currentDateTime} (UTC)
- Local timezone: ${timezone}
- Day of week: ${dayOfWeek}

User input: "${input}"

Output format: ${formatDescription}

Parse the user's input into ISO 8601 format. Return ONLY the formatted string, or "INVALID" if the input is incomplete or unparseable.`

  try {
    const result = await queryHaiku({
      systemPrompt,
      userPrompt,
      signal,
      options: {
        querySource: 'mcp_datetime_parse',
        agents: [],
        isNonInteractiveSession: false,
        hasAppendSystemPrompt: false,
        mcpTools: [],
        enablePromptCaching: false,
      },
    })

    // Extract text from result
    const parsedText = extractTextContent(result.message.content).trim()

    // Validate that we got something usable
    if (!parsedText || parsedText === 'INVALID') {
      return {
        success: false,
        error: 'Unable to parse date/time from input',
      }
    }

    // Basic sanity check - should start with a digit (year)
    if (!/^\d{4}/.test(parsedText)) {
      return {
        success: false,
        error: 'Unable to parse date/time from input',
      }
    }

    return { success: true, value: parsedText }
  } catch (error) {
    // Log error but don't expose details to user
    logError(error)
    return {
      success: false,
      error:
        'Unable to parse date/time. Please enter in ISO 8601 format manually.',
    }
  }
}

/**
 * Check if a string looks like it might be an ISO 8601 date/time.
 * Used to decide whether to attempt NL parsing.
 */
export function looksLikeISO8601(input: string): boolean {
  // ISO 8601 date: YYYY-MM-DD
  // ISO 8601 datetime: YYYY-MM-DDTHH:MM:SS...
  return /^\d{4}-\d{2}-\d{2}(T|$)/.test(input.trim())
}
