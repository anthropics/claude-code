import type { SessionMessage } from 'claude-code'

/**
 * An assistant message holding one TodoWrite whose items have the given
 * statuses.
 *
 * @param statuses each item's status
 * @returns the message
 */
export const todoWriteOf = (statuses: readonly string[]): SessionMessage => ({
  role: 'assistant',
  text: '',
  toolUses: [
    {
      tool_use_id: 'w',
      tool: 'TodoWrite',
      input: { todos: statuses.map(status => ({ content: 'x', status })) },
    },
  ],
})
