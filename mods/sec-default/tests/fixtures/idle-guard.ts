import type { Plugin } from 'claude-code/testing'

/**
 * A `user`-tier plugin that uses nothing, so `plugin.register` shows it as it
 * shows a plugin with no hooks module.
 */
export const idleGuard: Plugin = {
  name: 'guard',
  register() {},
}
