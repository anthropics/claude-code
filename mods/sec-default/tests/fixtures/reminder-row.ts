import type { Args } from 'claude-code'

/**
 * A reminder of the engine's own as the row a conversation is about to keep
 * of it.
 */
export const REMINDER_ROW: Args<'session.append'> = {
  message: {
    type: 'attachment',
    name: 'date_change',
    role: 'user',
    content: [{ type: 'text', text: 'the date is now 2026-09-25' }],
  },
  door: 'attachment',
  origin: { kind: 'engine' },
  uuid: 'row-reminder',
}
