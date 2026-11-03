import type { Plugin } from 'claude-code/testing'

/**
 * A plugin that reads `CORP_PROXY` when the session starts, in the tier
 * given (the person's own by default), and logs what it read.
 *
 * @param name the plugin's name
 * @param tier the tier it loads in
 * @returns the plugin
 */
export const readingProxy = (name: string, tier?: Plugin['tier']): Plugin => ({
  name,
  tier,
  register(on) {
    on('session.start', async ($, e, next) => {
      $.ui.log(`read ${String(await $.env.get('CORP_PROXY'))}`)

      return next(e)
    })
  },
})
