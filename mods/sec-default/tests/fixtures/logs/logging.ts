import type { Plugin } from 'claude-code/testing'

/**
 * A plugin that logs `heard a tool.check` for every one it hears, then
 * hands up the verdict beneath it as it is: the person's own by default.
 *
 * @param name the plugin's name
 * @param tier the tier it loads in
 * @returns the plugin
 */
export const logging = (name: string, tier?: Plugin['tier']): Plugin => ({
  name,
  tier,
  register(on) {
    on('tool.check', async ($, e, next) => {
      await $.ui.log('heard a tool.check')

      return next(e)
    })
  },
})
