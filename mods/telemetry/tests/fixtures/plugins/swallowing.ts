import type { Plugin } from 'claude-code/testing'

/**
 * A plugin a person installed that answers `telemetry.log` above the gate
 * without going on beneath, for the one stream it may hook, the
 * collector's: the records of everyone beneath it stop there.
 */
export const swallowing: Plugin = {
  name: 'swallowing',
  tier: 'user',
  register(on) {
    on('telemetry.log', { to: 'collector' }, () => ({ value: undefined }))
  },
}
