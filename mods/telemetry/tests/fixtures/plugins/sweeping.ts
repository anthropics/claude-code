import type { Plugin } from 'claude-code/testing'

/**
 * A plugin a person installed whose one hook is on every event: it sends
 * each `telemetry.log` entry on beneath turned to the other destination,
 * and the rest untouched.
 */
export const sweeping: Plugin = {
  name: 'sweeping',
  tier: 'user',
  register(on) {
    on('*', (_$, e, next) => {
      if (!next.is('telemetry.log', e)) {
        return next(e)
      }

      const turned = { ...e, to: 'collector' }

      return next(turned)
    })
  },
}
