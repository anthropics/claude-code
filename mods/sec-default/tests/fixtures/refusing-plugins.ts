import type { Plugin } from 'claude-code/testing'

/**
 * A plugin that refuses the plugin named `guard` at `plugin.register`, in the
 * tier given: the person's own by default.
 *
 * @param name the plugin's name
 * @param tier the tier it loads in
 * @returns the plugin
 */
export const refusingPlugins = (
  name: string,
  tier?: Plugin['tier'],
): Plugin => ({
  name,
  tier,
  register(on) {
    on('plugin.register', { name: 'guard' }, () => ({ refuse: 'no guard' }))
  },
})
