import type { LogOption, SerializedMessage } from '../types/logs.js'
import { count } from './array.js'
import { logForDebugging } from './debug.js'
import { getLogDisplayTitle, logError } from './log.js'
import { getSmallFastModel } from './model/model.js'
import { isLiteLog, loadFullLog } from './sessionStorage.js'
import { sideQuery } from './sideQuery.js'
import { jsonParse } from './slowOperations.js'

// Limits for transcript extraction
const MAX_TRANSCRIPT_CHARS = 2000 // Max chars of transcript per session
const MAX_MESSAGES_TO_SCAN = 100 // Max messages to scan from start/end
const MAX_SESSIONS_TO_SEARCH = 100 // Max sessions to send to the API

const SESSION_SEARCH_SYSTEM_PROMPT = `Your goal is to find relevant sessions based on a user's search query.

You will be given a list of sessions with their metadata and a search query. Identify which sessions are most relevant to the query.

Each session may include:
- Title (display name or custom title)
- Tag (user-assigned category, shown as [tag: name] - users tag sessions with /tag command to categorize them)
- Branch (git branch name, shown as [branch: name])
- Summary (AI-generated summary)
- First message (beginning of the conversation)
- Transcript (excerpt of conversation content)

IMPORTANT: Tags are user-assigned labels that indicate the session's topic or category. If the query matches a tag exactly or partially, those sessions should be highly prioritized.

For each session, consider (in order of priority):
1. Exact tag matches (highest priority - user explicitly categorized this session)
2. Partial tag matches or tag-related terms
3. Title matches (custom titles or first message content)
4. Branch name matches
5. Summary and transcript content matches
6. Semantic similarity and related concepts

CRITICAL: Be VERY inclusive in your matching. Include sessions that:
- Contain the query term anywhere in any field
- Are semantically related to the query (e.g., "testing" matches sessions about "tests", "unit tests", "QA", etc.)
- Discuss topics that could be related to the query
- Have transcripts that mention the concept even in passing

When in doubt, INCLUDE the session. It's better to return too many results than too few. The user can easily scan through results, but missing relevant sessions is frustrating.

Return sessions ordered by relevance (most relevant first). If truly no sessions have ANY connection to the query, return an empty array - but this should be rare.

Respond with ONLY the JSON object, no markdown formatting:
{"relevant_indices": [2, 5, 0]}`

type AgenticSearchResult = {
  relevant_indices: number[]
}

/**
 * Extracts searchable text content from a message.
 */
function extractMessageText(message: SerializedMessage): string {
  if (message.type !== 'user' && message.type !== 'assistant') {
    return ''
  }

  const content = 'message' in message ? message.message?.content : undefined
  if (!content) return ''

  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map(block => {
        if (typeof block === 'string') return block
        if ('text' in block && typeof block.text === 'string') return block.text
        return ''
      })
      .filter(Boolean)
      .join(' ')
  }

  return ''
}

/**
 * Extracts a truncated transcript from session messages.
 */
function extractTranscript(messages: SerializedMessage[]): string {
  if (messages.length === 0) return ''

  // Take messages from start and end to get context
  const messagesToScan =
    messages.length <= MAX_MESSAGES_TO_SCAN
      ? messages
      : [
          ...messages.slice(0, MAX_MESSAGES_TO_SCAN / 2),
          ...messages.slice(-MAX_MESSAGES_TO_SCAN / 2),
        ]

  const text = messagesToScan
    .map(extractMessageText)
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  return text.length > MAX_TRANSCRIPT_CHARS
    ? text.slice(0, MAX_TRANSCRIPT_CHARS) + '…'
    : text
}

/**
 * Checks if a log contains the query term in any searchable field.
 */
function logContainsQuery(log: LogOption, queryLower: string): boolean {
  // Check title
  const title = getLogDisplayTitle(log).toLowerCase()
  if (title.includes(queryLower)) return true

  // Check custom title
  if (log.customTitle?.toLowerCase().includes(queryLower)) return true

  // Check tag
  if (log.tag?.toLowerCase().includes(queryLower)) return true

  // Check branch
  if (log.gitBranch?.toLowerCase().includes(queryLower)) return true

  // Check summary
  if (log.summary?.toLowerCase().includes(queryLower)) return true

  // Check first prompt
  if (log.firstPrompt?.toLowerCase().includes(queryLower)) return true

  // Check transcript (more expensive, do last)
  if (log.messages && log.messages.length > 0) {
    const transcript = extractTranscript(log.messages).toLowerCase()
    if (transcript.includes(queryLower)) return true
  }

  return false
}

/**
 * Performs an agentic search using Claude to find relevant sessions
 * based on semantic understanding of the query.
 */
export async function agenticSessionSearch(
  query: string,
  logs: LogOption[],
  signal?: AbortSignal,
): Promise<LogOption[]> {
  if (!query.trim() || logs.length === 0) {
    return []
  }

  const queryLower = query.toLowerCase()

  // Pre-filter: find sessions that contain the query term
  // This ensures we search relevant sessions, not just recent ones
  const matchingLogs = logs.filter(log => logContainsQuery(log, queryLower))

  // Take up to MAX_SESSIONS_TO_SEARCH matching logs
  // If fewer matches, fill remaining slots with recent non-matching logs for context
  let logsToSearch: LogOption[]
  if (matchingLogs.length >= MAX_SESSIONS_TO_SEARCH) {
    logsToSearch = matchingLogs.slice(0, MAX_SESSIONS_TO_SEARCH)
  } else {
    const nonMatchingLogs = logs.filter(
      log => !logContainsQuery(log, queryLower),
    )
    const remainingSlots = MAX_SESSIONS_TO_SEARCH - matchingLogs.length
    logsToSearch = [
      ...matchingLogs,
      ...nonMatchingLogs.slice(0, remainingSlots),
    ]
  }

  // Debug: log what data we have
  logForDebugging(
    `Agentic search: ${logsToSearch.length}/${logs.length} logs, query="${query}", ` +
      `matching: ${matchingLogs.length}, with messages: ${count(logsToSearch, l => l.messages?.length > 0)}`,
  )

  // Load full logs for lite logs to get transcript content
  const logsWithTranscriptsPromises = logsToSearch.map(async log => {
    if (isLiteLog(log)) {
      try {
        return await loadFullLog(log)
      } catch (error) {
        logError(error as Error)
        // If loading fails, use the lite log (no transcript)
        return log
      }
    }
    return log
  })
  const logsWithTranscripts = await Promise.all(logsWithTranscriptsPromises)

  logForDebugging(
    `Agentic search: loaded ${count(logsWithTranscripts, l => l.messages?.length > 0)}/${logsToSearch.length} logs with transcripts`,
  )

  // Build session list for the prompt with all searchable metadata
  const sessionList = logsWithTranscripts
    .map((log, index) => {
      const parts: string[] = [`${index}:`]

      // Title (display title, may be custom or from first prompt)
      const displayTitle = getLogDisplayTitle(log)
      parts.push(displayTitle)

      // Custom title if different from display title
      if (log.customTitle && log.customTitle !== displayTitle) {
        parts.push(`[custom title: ${log.customTitle}]`)
      }

      // Tag
      if (log.tag) {
        parts.push(`[tag: ${log.tag}]`)
      }

      // Git branch
      if (log.gitBranch) {
        parts.push(`[branch: ${log.gitBranch}]`)
      }

      // Summary
      if (log.summary) {
        parts.push(`- Summary: ${log.summary}`)
      }

      // First prompt content (truncated)
      if (log.firstPrompt && log.firstPrompt !== 'No prompt') {
        parts.push(`- First message: ${log.firstPrompt.slice(0, 300)}`)
      }

      // Transcript excerpt (if messages are available)
      if (log.messages && log.messages.length > 0) {
        const transcript = extractTranscript(log.messages)
        if (transcript) {
          parts.push(`- Transcript: ${transcript}`)
        }
      }

      return parts.join(' ')
    })
    .join('\n')

  const userMessage = `Sessions:
${sessionList}

Search query: "${query}"

Find the sessions that are most relevant to this query.`

  // Debug: log first part of the session list
  logForDebugging(
    `Agentic search prompt (first 500 chars): ${userMessage.slice(0, 500)}...`,
  )

  try {
    const model = getSmallFastModel()
    logForDebugging(`Agentic search using model: ${model}`)

    const response = await sideQuery({
      model,
      system: SESSION_SEARCH_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      signal,
      querySource: 'session_search',
    })

    // Extract the text content from the response
    const textContent = response.content.find(block => block.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      logForDebugging('No text content in agentic search response')
      return []
    }

    // Debug: log the response
    logForDebugging(`Agentic search response: ${textContent.text}`)

    // Parse the JSON response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      logForDebugging('Could not find JSON in agentic search response')
      return []
    }

    const result: AgenticSearchResult = jsonParse(jsonMatch[0])
    const relevantIndices = result.relevant_indices || []

    // Map indices back to logs (indices are relative to logsWithTranscripts)
    const relevantLogs = relevantIndices
      .filter(index => index >= 0 && index < logsWithTranscripts.length)
      .map(index => logsWithTranscripts[index]!)

    logForDebugging(
      `Agentic search found ${relevantLogs.length} relevant sessions`,
    )

    return relevantLogs
  } catch (error) {
    logError(error as Error)
    logForDebugging(`Agentic search error: ${error}`)
    return []
  }
}
