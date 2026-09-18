import type { Plugin } from 'claude-code/testing'

/**
 * A plugin standing in for the telemetry built-in: it adds the `telemetry`
 * noun at `engine.create` over the nouns beneath.
 *
 * Its `log` and `mark` write the entry they are handed as one `$.ui.log`
 * line, `<op> <json>`, which startedOf keeps and rowsOf reads back.
 */
export const RECORDING: Plugin = {
  name: 'recording',
  tier: 'builtin',
  register(on) {
    on('engine.create', async ($, e, next) => {
      const beneath = await next(e)
      const built = { ...beneath }
      built.telemetry = {
        log: async entry => {
          await beneath.ui.log(`log ${JSON.stringify(entry)}`)
        },
        mark: async entry => {
          await beneath.ui.log(`mark ${JSON.stringify(entry)}`)
        },
      }

      return built
    })
  },
}
