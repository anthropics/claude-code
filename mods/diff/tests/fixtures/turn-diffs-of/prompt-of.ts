import type { SessionMessage } from 'claude-code'

/**
 * A prompt the person typed, as the transcript holds it.
 *
 * @param text the prompt
 * @returns the message
 */
export const promptOf = (text: string): SessionMessage => ({
  role: 'user',
  text,
  toolUses: [],
})
