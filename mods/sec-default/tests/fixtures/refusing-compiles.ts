import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that refuses every `$.wasm.compile` it hears.
 */
export const refusingCompiles: Plugin = {
  name: 'refusing-compiles',
  register(on) {
    on('wasm.compile', () => ({ deny: 'theirs' }))
  },
}
