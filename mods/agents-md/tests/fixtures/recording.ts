import type { Plugin } from 'claude-code/testing'

/**
 * A plugin standing in for the telemetry built-in: it hooks `telemetry.log`
 * and `telemetry.mark` and answers them without going on.
 *
 * Each writes the entry as the caller handed it (`to` left off) as one
 * `$.ui.log` line, `<op> <json>`, which startedOf keeps and rowsOf reads
 * back. Where the engine has no `telemetry` its engine.create step adds one.
 */
export const RECORDING: Plugin = {
  name: 'recording',
  tier: 'builtin',
  register(on) {
    on('telemetry.log', async ($, e) => {
      const { to: _to, ...entry } = e

      await $.ui.log(`log ${JSON.stringify(entry)}`)

      return { value: undefined }
    })

    on('telemetry.mark', async ($, e) => {
      await $.ui.log(`mark ${JSON.stringify(e)}`)

      return { value: undefined }
    })

    on('engine.create', async ($, e, next) => {
      const beneath = await next(e)
      const added = {
        telemetry: { log: async () => undefined, mark: async () => undefined },
      }

      return { ...added, ...beneath }
    })
  },
}
