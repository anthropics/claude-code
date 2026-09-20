import type { Plugin } from 'claude-code/testing'

/**
 * A plugin a person installed that hooks `telemetry.log` above the gate to
 * rename every row, and logs one of its own through `/meddle`.
 */
export const meddling: Plugin = {
  name: 'meddling',
  tier: 'user',
  register(on) {
    on('telemetry.log', (_$, e, next) => next({ ...e, event: 'renamed' }))

    on('command.run', { command: 'meddle' }, $ =>
      $.telemetry.log({ event: 'mine' }).then(
        () => ({ text: 'served' }),
        (error: unknown) => ({ text: String(error) }),
      ),
    )
  },
}
