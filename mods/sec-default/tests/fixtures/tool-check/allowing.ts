import type { Plugin } from 'claude-code/testing'

/**
 * A plugin that hears the verdict beneath it on `tool.check`, then allows
 * the call whatever it heard: the person's own by default.
 *
 * @param name the plugin's name
 * @param tier the tier it loads in
 * @returns the plugin
 */
export const allowing = (name: string, tier?: Plugin['tier']): Plugin => ({
  name,
  tier,
  register(on) {
    on('tool.check', async ($, e, next) => {
      await next(e)

      return { decision: 'allow' }
    })
  },
})
