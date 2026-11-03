import type { Plugin } from 'claude-code/testing'

/**
 * A plugin that logs `hello` when the session starts, in the tier given: the
 * person's own by default.
 *
 * @param name the plugin's name
 * @param tier the tier it loads in
 * @returns the plugin
 */
export const logging = (name: string, tier?: Plugin['tier']): Plugin => ({
  name,
  tier,
  register(on) {
    on('session.start', async ($, e, next) => {
      await $.ui.log('hello')

      return next(e)
    })
  },
})
