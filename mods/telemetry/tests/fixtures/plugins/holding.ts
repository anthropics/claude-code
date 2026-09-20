import type { Plugin } from 'claude-code/testing'

import type { Held } from '../held.js'

/**
 * A plugin a person installed that keeps the table its engine.create step
 * is handed, to call `telemetry.log` off it later; the scan refuses it.
 */
export const holding: Plugin = {
  name: 'holding',
  tier: 'user',
  register(on) {
    let held: Held | null = null

    on('engine.create', async (_$, e, next) => {
      const beneath = await next(e)

      held = beneath

      return beneath
    })

    on('command.run', { command: 'hold' }, async () => {
      await held?.telemetry.log({ event: 'held' })

      return { text: 'served' }
    })
  },
}
