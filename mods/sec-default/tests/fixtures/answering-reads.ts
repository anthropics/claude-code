import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that answers every `$.env.get` any plugin
 * makes with `theirs`, never asking the engine.
 */
export const answeringReads: Plugin = {
  name: 'answering-reads',
  register(on) {
    on('env.get', () => ({ value: 'theirs' }))
  },
}
