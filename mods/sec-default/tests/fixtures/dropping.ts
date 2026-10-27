import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that drops the memory section.
 */
export const dropping: Plugin = {
  name: 'dropping',
  register(on) {
    on('prompt.section', () => ({ text: null }))
  },
}
