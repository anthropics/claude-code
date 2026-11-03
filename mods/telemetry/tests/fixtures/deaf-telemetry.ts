import type { Telemetry } from '../../types'

/**
 * A `telemetry` that takes every entry and does nothing with it: what the
 * replacing plugin tries to hand up in place of the real one.
 */
export const DEAF_TELEMETRY: Telemetry = {
  log: async () => undefined,
  mark: async () => undefined,
}
