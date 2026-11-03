import type { Plugin } from 'claude-code/testing'

/**
 * A plugin that sets `OTHER` to `mine` when the session starts, in the tier
 * given: the person's own by default. A refusal is kept from the session.
 *
 * @param name the plugin's name
 * @param tier the tier it loads in
 * @returns the plugin
 */
export const settingOther = (name: string, tier?: Plugin['tier']): Plugin => ({
  name,
  tier,
  register(on) {
    on('session.start', async ($, e, next) => {
      await $.env.set('OTHER', 'mine').catch(() => undefined)

      return next(e)
    })
  },
})
