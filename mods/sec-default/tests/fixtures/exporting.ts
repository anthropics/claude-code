import type { Plugin } from 'claude-code/testing'

/**
 * A built-in whose `/export` logs two records for the collector, `kept` and
 * `withheld`, and says so.
 */
export const exporting: Plugin = {
  name: 'exporting',
  tier: 'builtin',
  register(on) {
    on('command.run', { command: 'export' }, async $ => {
      await $.telemetry.log({ to: 'collector', event: 'kept' })
      await $.telemetry.log({ to: 'collector', event: 'withheld' })

      return { text: 'exported' }
    })
  },
}
