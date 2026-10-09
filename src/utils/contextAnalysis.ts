import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import type {
  ContentBlock,
  ContentBlockParam,
} from '@anthropic-ai/sdk/resources/index.mjs'
import { roughTokenCountEstimation as countTokens } from '../services/tokenEstimation.js'
import type {
  AssistantMessage,
  Message,
  UserMessage,
} from '../types/message.js'
import { normalizeMessagesForAPI } from './messages.js'
import { jsonStringify } from './slowOperations.js'

type TokenStats = {
  toolRequests: Map<string, number>
  toolResults: Map<string, number>
  humanMessages: number
  assistantMessages: number
  localCommandOutputs: number
  other: number
  attachments: Map<string, number>
  duplicateFileReads: Map<string, { count: number; tokens: number }>
  total: number
}

export function analyzeContext(messages: Message[]): TokenStats {
  const stats: TokenStats = {
    toolRequests: new Map(),
    toolResults: new Map(),
    humanMessages: 0,
    assistantMessages: 0,
    localCommandOutputs: 0,
    other: 0,
    attachments: new Map(),
    duplicateFileReads: new Map(),
    total: 0,
  }

  const toolIdsToToolNames = new Map<string, string>()
  const readToolIdToFilePath = new Map<string, string>()
  const fileReadStats = new Map<
    string,
    { count: number; totalTokens: number }
  >()

  messages.forEach(msg => {
    if (msg.type === 'attachment') {
      const type = msg.attachment.type || 'unknown'
      stats.attachments.set(type, (stats.attachments.get(type) || 0) + 1)
    }
  })

  const normalizedMessages = normalizeMessagesForAPI(messages)
  normalizedMessages.forEach(msg => {
    const { content } = msg.message

    // Not sure if this path is still used, but adding as a fallback
    if (typeof content === 'string') {
      const tokens = countTokens(content)
      stats.total += tokens
      // Check if this is a local command output
      if (msg.type === 'user' && content.includes('local-command-stdout')) {
        stats.localCommandOutputs += tokens
      } else {
        stats[msg.type === 'user' ? 'humanMessages' : 'assistantMessages'] +=
          tokens
      }
    } else {
      content.forEach(block =>
        processBlock(
          block,
          msg,
          stats,
          toolIdsToToolNames,
          readToolIdToFilePath,
          fileReadStats,
        ),
      )
    }
  })

  // Calculate duplicate file reads
  fileReadStats.forEach((data, path) => {
    if (data.count > 1) {
      const averageTokensPerRead = Math.floor(data.totalTokens / data.count)
      const duplicateTokens = averageTokensPerRead * (data.count - 1)

      stats.duplicateFileReads.set(path, {
        count: data.count,
        tokens: duplicateTokens,
      })
    }
  })

  return stats
}

function processBlock(
  block: ContentBlockParam | ContentBlock | BetaContentBlock,
  message: UserMessage | AssistantMessage,
  stats: TokenStats,
  toolIds: Map<string, string>,
  readToolPaths: Map<string, string>,
  fileReads: Map<string, { count: number; totalTokens: number }>,
): void {
  const tokens = countTokens(jsonStringify(block))
  stats.total += tokens

  switch (block.type) {
    case 'text':
      // Check if this is a local command output
      if (
        message.type === 'user' &&
        'text' in block &&
        block.text.includes('local-command-stdout')
      ) {
        stats.localCommandOutputs += tokens
      } else {
        stats[
          message.type === 'user' ? 'humanMessages' : 'assistantMessages'
        ] += tokens
      }
      break

    case 'tool_use': {
      if ('name' in block && 'id' in block) {
        const toolName = block.name || 'unknown'
        increment(stats.toolRequests, toolName, tokens)
        toolIds.set(block.id, toolName)

        // Track Read tool file paths
        if (
          toolName === 'Read' &&
          'input' in block &&
          block.input &&
          typeof block.input === 'object' &&
          'file_path' in block.input
        ) {
          const path = String(
            (block.input as Record<string, unknown>).file_path,
          )
          readToolPaths.set(block.id, path)
        }
      }
      break
    }

    case 'tool_result': {
      if ('tool_use_id' in block) {
        const toolName = toolIds.get(block.tool_use_id) || 'unknown'
        increment(stats.toolResults, toolName, tokens)

        // Track file read tokens
        if (toolName === 'Read') {
          const path = readToolPaths.get(block.tool_use_id)
          if (path) {
            const current = fileReads.get(path) || { count: 0, totalTokens: 0 }
            fileReads.set(path, {
              count: current.count + 1,
              totalTokens: current.totalTokens + tokens,
            })
          }
        }
      }
      break
    }

    case 'image':
    case 'server_tool_use':
    case 'web_search_tool_result':
    case 'search_result':
    case 'document':
    case 'thinking':
    case 'redacted_thinking':
    case 'code_execution_tool_result':
    case 'mcp_tool_use':
    case 'mcp_tool_result':
    case 'container_upload':
    case 'web_fetch_tool_result':
    case 'bash_code_execution_tool_result':
    case 'text_editor_code_execution_tool_result':
    case 'tool_search_tool_result':
    case 'compaction':
      // Don't care about these for now..
      stats['other'] += tokens
      break
  }
}

function increment(map: Map<string, number>, key: string, value: number): void {
  map.set(key, (map.get(key) || 0) + value)
}

export function tokenStatsToStatsigMetrics(
  stats: TokenStats,
): Record<string, number> {
  const metrics: Record<string, number> = {
    total_tokens: stats.total,
    human_message_tokens: stats.humanMessages,
    assistant_message_tokens: stats.assistantMessages,
    local_command_output_tokens: stats.localCommandOutputs,
    other_tokens: stats.other,
  }

  stats.attachments.forEach((count, type) => {
    metrics[`attachment_${type}_count`] = count
  })

  stats.toolRequests.forEach((tokens, tool) => {
    metrics[`tool_request_${tool}_tokens`] = tokens
  })

  stats.toolResults.forEach((tokens, tool) => {
    metrics[`tool_result_${tool}_tokens`] = tokens
  })

  const duplicateTotal = [...stats.duplicateFileReads.values()].reduce(
    (sum, d) => sum + d.tokens,
    0,
  )

  metrics.duplicate_read_tokens = duplicateTotal
  metrics.duplicate_read_file_count = stats.duplicateFileReads.size

  if (stats.total > 0) {
    metrics.human_message_percent = Math.round(
      (stats.humanMessages / stats.total) * 100,
    )
    metrics.assistant_message_percent = Math.round(
      (stats.assistantMessages / stats.total) * 100,
    )
    metrics.local_command_output_percent = Math.round(
      (stats.localCommandOutputs / stats.total) * 100,
    )
    metrics.duplicate_read_percent = Math.round(
      (duplicateTotal / stats.total) * 100,
    )

    const toolRequestTotal = [...stats.toolRequests.values()].reduce(
      (sum, v) => sum + v,
      0,
    )
    const toolResultTotal = [...stats.toolResults.values()].reduce(
      (sum, v) => sum + v,
      0,
    )

    metrics.tool_request_percent = Math.round(
      (toolRequestTotal / stats.total) * 100,
    )
    metrics.tool_result_percent = Math.round(
      (toolResultTotal / stats.total) * 100,
    )

    // Add individual tool request percentages
    stats.toolRequests.forEach((tokens, tool) => {
      metrics[`tool_request_${tool}_percent`] = Math.round(
        (tokens / stats.total) * 100,
      )
    })

    // Add individual tool result percentages
    stats.toolResults.forEach((tokens, tool) => {
      metrics[`tool_result_${tool}_percent`] = Math.round(
        (tokens / stats.total) * 100,
      )
    })
  }

  return metrics
}
