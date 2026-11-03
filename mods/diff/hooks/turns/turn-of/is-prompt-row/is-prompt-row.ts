import type { SessionMessage } from 'claude-code'

/**
 * Whether a transcript row starts a turn: a user message that carries text
 * and no tool results (`$.session.messages()` already leaves out meta rows).
 *
 * @param message one row of the transcript
 * @returns whether it is a typed prompt
 */
export const isPromptRow = (message: SessionMessage) =>
  message.role === 'user' &&
  (message.toolResults === undefined || message.toolResults.length === 0) &&
  message.text !== ''
