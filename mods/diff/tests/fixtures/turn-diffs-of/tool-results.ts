import type { SessionMessage } from 'claude-code'

/**
 * The message that carries a turn's tool results back, no text of its own.
 *
 * @returns the message
 */
export const toolResults = (): SessionMessage => ({
  role: 'user',
  text: '',
  toolUses: [],
  toolResults: [{ tool_use_id: 't', text: 'ok', isError: false }],
})
