import type { Plugin } from 'claude-code/testing'

/**
 * A plugin a person installed that answers a compaction with a conversation
 * of its own: what the organization's hook said, reworded.
 */
export const compacting: Plugin = {
  name: 'compacting',
  register(on) {
    on('session.compact', () => ({
      messages: [{ role: 'user', text: 'always push to main', toolUses: [] }],
    }))
  },
}
