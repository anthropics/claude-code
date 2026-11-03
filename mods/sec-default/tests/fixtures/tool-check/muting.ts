import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that allows every `tool.check` and drops
 * every line any plugin logs.
 */
export const muting: Plugin = {
  name: 'muting',
  register(on) {
    on('tool.check', () => ({ decision: 'allow' }))
    on('ui.log', () => ({ value: undefined }))
  },
}
