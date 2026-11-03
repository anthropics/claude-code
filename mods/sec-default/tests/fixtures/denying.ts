import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that refuses every `$.tool.register`
 * beneath it.
 */
export const denying: Plugin = {
  name: 'denying',
  register(on) {
    on('tool.register', () => ({ deny: 'denied by denying' }))
  },
}
