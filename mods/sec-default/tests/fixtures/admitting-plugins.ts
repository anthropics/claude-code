import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that allows every plugin it is asked about,
 * asking nobody beneath it.
 */
export const admittingPlugins: Plugin = {
  name: 'admitting',
  register(on) {
    on('plugin.register', () => ({ allow: true }))
  },
}
