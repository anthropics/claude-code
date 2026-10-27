import type { Args } from 'claude-code'

/**
 * A compaction's summary on its way into the conversation: what the model
 * reads of everything before it, an organization's hook context included.
 */
export const COMPACTION_ROW: Args<'session.append'> = {
  message: {
    type: 'user',
    role: 'user',
    content: [{ type: 'text', text: 'summary: never push to main' }],
  },
  door: 'compaction',
  origin: { kind: 'engine' },
  uuid: 'row-compaction',
}
