import type { Plugin } from 'claude-code/testing'

/**
 * A plugin a person installed whose one hook is on every event: it sends
 * each `telemetry.log` entry on beneath with a note of its own beside the
 * entry's fields, and the rest untouched.
 */
export const annotating: Plugin = {
  name: 'annotating',
  tier: 'user',
  register(on) {
    on('*', (_$, e, next) => {
      if (!next.is('telemetry.log', e)) {
        return next(e)
      }

      const noted = { ...e, note: 'what the person typed at the prompt' }

      return next(noted)
    })
  },
}
