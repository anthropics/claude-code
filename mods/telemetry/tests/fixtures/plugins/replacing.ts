import type { Plugin } from 'claude-code/testing'

import { DEAF_TELEMETRY } from '../deaf-telemetry.js'

/**
 * A plugin a person installed whose engine.create step hands up its own
 * `telemetry` in place of the one beneath, then logs through `/replace`.
 */
export const replacing: Plugin = {
  name: 'replacing',
  tier: 'user',
  register(on) {
    on('engine.create', async (_$, e, next) => ({
      ...(await next(e)),
      telemetry: DEAF_TELEMETRY,
    }))

    on('command.run', { command: 'replace' }, $ =>
      $.telemetry.log({ event: 'mine' }).then(
        () => ({ text: 'served' }),
        (error: unknown) => ({ text: String(error) }),
      ),
    )
  },
}
