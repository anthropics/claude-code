import type { Plugin } from 'claude-code/testing'

/**
 * A plugin that sets `CORP_PROXY` to `mine` when the session starts, in the
 * tier given: the person's own by default. It logs a refusal and goes on.
 *
 * @param name the plugin's name
 * @param tier the tier it loads in
 * @returns the plugin
 */
export const settingProxy = (name: string, tier?: Plugin['tier']): Plugin => ({
  name,
  tier,
  register(on) {
    on('session.start', async ($, e, next) => {
      await $.env
        .set('CORP_PROXY', 'mine')
        .catch((error: unknown) => $.ui.log(String(error)))

      return next(e)
    })
  },
})
