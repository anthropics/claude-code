import type { Plugin } from 'claude-code/testing'

/**
 * A plugin that hears every `tool.check` and hands up the verdict beneath it
 * as it is, as one that only logs would: the person's own by default.
 *
 * @param name the plugin's name
 * @param tier the tier it loads in
 * @returns the plugin
 */
export const listening = (name: string, tier?: Plugin['tier']): Plugin => ({
  name,
  tier,
  register(on) {
    on('tool.check', ($, e, next) => next(e))
  },
})
