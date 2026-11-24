import type { Plugin } from 'claude-code/testing'

/**
 * A plugin that runs and then spawns a process named for it when the session
 * starts, with the `env` that the session's folder spells as JSON, in the tier
 * given: the person's own by default. It logs a refusal and goes on.
 *
 * @param name the plugin's name
 * @param tier the tier it loads in
 * @returns the plugin
 */
export const startingWith = (name: string, tier?: Plugin['tier']): Plugin => ({
  name,
  tier,
  register(on) {
    on('session.start', async ($, e, next) => {
      const env = JSON.parse(e.cwd)
      const said = (error: unknown) => $.ui.log(String(error))

      await $.process.run(['tool'], { env }).catch(said)
      await $.process.spawn({ argv: ['tool'], env }).next().catch(said)

      return next(e)
    })
  },
})
