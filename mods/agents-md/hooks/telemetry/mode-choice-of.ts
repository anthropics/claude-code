import Modes from '../modes'
import type { TelemetryProp } from './types'

/**
 * The mode as a row carries it: the value with the four it is chosen from.
 *
 * @param mode the configured mode
 * @returns the `mode` property
 */
export const modeChoiceOf = (mode: Modes.Mode): TelemetryProp => ({
  value: mode,
  of: Modes.MODES,
})
