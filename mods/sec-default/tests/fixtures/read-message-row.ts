import type { Args } from 'claude-code'

/**
 * A row another tool hands over beside its result: no skill's body.
 */
export const READ_MESSAGE_ROW: Args<'session.append'> = {
  message: {
    type: 'user',
    role: 'user',
    isMeta: true,
    content: [{ type: 'text', text: 'the file, expanded' }],
  },
  door: 'tool-message',
  origin: { kind: 'tool', tool: 'Read' },
  uuid: 'row-read-message',
}
