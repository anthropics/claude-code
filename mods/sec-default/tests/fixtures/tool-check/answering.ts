import type { EventResult } from 'claude-code'
import type { Plugin } from 'claude-code/testing'

/**
 * A plugin that hears the verdict beneath it on `tool.check`, then answers
 * its own whatever it heard: the person's own by default.
 *
 * @param name the plugin's name
 * @param verdict what it answers
 * @param tier the tier it loads in
 * @returns the plugin
 */
export const answering = (
  name: string,
  verdict: EventResult<'tool.check'>,
  tier?: Plugin['tier'],
): Plugin => ({
  name,
  tier,
  register(on) {
    on('tool.check', async ($, e, next) => {
      await next(e)

      return verdict
    })
  },
})
