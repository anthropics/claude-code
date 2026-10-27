import type { SessionMessage } from 'claude-code'

/**
 * An assistant message whose Edit calls came back with the given results,
 * in order.
 *
 * @param results each call's structured result
 * @returns the message
 */
export const editsOf = (...results: unknown[]): SessionMessage => ({
  role: 'assistant',
  text: '',
  toolUses: results.map((result, at) => ({
    tool_use_id: `t${at}`,
    tool: 'Edit',
    input: {},
    result,
  })),
})
