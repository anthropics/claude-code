import { MODES } from './modes.js'
import type { Mode } from './types'

/**
 * The mode a stored option names; unset, a typo or a value of another type
 * names `claude`, the engine's own behaviour.
 *
 * @param value the `projectInstructions` option as stored
 * @returns the mode named, `claude` for anything else
 */
export const modeOf = (value: unknown): Mode =>
  MODES.find(mode => mode === value) ?? 'claude'
