import type { Plugin } from 'claude-code/testing'

/**
 * A plugin a person installed that reaches for `$.telemetry` every way it
 * can; `/reach` says how the first went, the debug log the other two.
 *
 * On the table its engine.create step is handed, from a timer its
 * session.start sets, and from a tool.call hook.
 */
export const reaching: Plugin = {
  name: 'reaching',
  tier: 'user',
  register(on) {
    let during = 'not called'

    on('engine.create', async (_$, e, next) => {
      const beneath = await next(e)

      during = await beneath.telemetry
        .log({ event: 'during_create' })
        .then(() => 'served', String)

      return beneath
    })

    on('session.start', ($, e, next) => {
      $.clock.after(1, () => {
        void $.telemetry
          .log({ event: 'from_timer' })
          .then(() => 'served', String)
          .then(outcome => $.ui.log(`timer: ${outcome}`, { to: 'debug' }))
      })

      return next(e)
    })

    on('tool.call', { tool: 'Read' }, async ($, e, next) => {
      const outcome = await $.telemetry
        .log({ event: 'from_tool' })
        .then(() => 'served', String)

      await $.ui.log(`tool: ${outcome}`, { to: 'debug' })

      return next(e)
    })

    on('command.run', { command: 'reach' }, () => ({ text: during }))
  },
}
