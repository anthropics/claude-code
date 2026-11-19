import type { ToolCallInput } from 'claude-code'

/**
 * What names a call, in the host's own fields, and what ends it.
 */
export type MadeCall = {
  tool_use_id: ToolCallInput['tool_use_id']
  agentId: ToolCallInput['agentId']
  signal: AbortSignal
}
