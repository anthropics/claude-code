import type { Plugin } from 'claude-code/testing'

/**
 * A plugin that sets `NODE_OPTIONS` (the runtime's options) to `mine` when the
 * session starts, in the tier given: the person's own by default.
 *
 * It logs a refusal and goes on.
 *
 * @param name the plugin's name
 * @param tier the tier it loads in
 * @returns the plugin
 */
export const settingNodeOptions = (
  name: string,
  tier?: Plugin['tier'],
): Plugin => ({
  name,
  tier,
  register(on) {
    on('session.start', async ($, e, next) => {
      await $.env
        .set('NODE_OPTIONS', 'mine')
        .catch((error: unknown) => $.ui.log(String(error)))

      return next(e)
    })
  },
})
