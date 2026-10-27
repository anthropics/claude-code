import { DEFAULT_MODE } from './default-mode.js'
import { MODES } from './modes.js'
import type { Mode } from './types'

/**
 * The mode a stored option names; unset, a typo or a value of another type
 * names the default.
 *
 * @param value the `instructionFiles` option as stored
 * @returns the mode named, DEFAULT_MODE for anything else
 */
export const modeOf = (value: unknown): Mode =>
  MODES.find(mode => mode === value) ?? DEFAULT_MODE
