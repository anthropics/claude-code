import type { Args } from 'claude-code'

/**
 * A prompt the person typed as the row a conversation is about to keep of it.
 */
export const PROMPT_ROW: Args<'session.append'> = {
  message: {
    type: 'user',
    role: 'user',
    content: [{ type: 'text', text: 'what a person typed' }],
  },
  door: 'prompt',
  origin: { kind: 'composer' },
  uuid: 'row-prompt',
}
