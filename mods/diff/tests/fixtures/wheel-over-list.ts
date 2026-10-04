import type { UiScrollInput } from 'claude-code'

import { WHEEL_TICK } from './wheel-tick.js'

/**
 * The same wheel tick with the pointer over the docked list's third row
 * (top pad, header, the list's margin, then the rows).
 */
export const WHEEL_OVER_LIST: UiScrollInput = {
  ...WHEEL_TICK,
  pointer: { column: 10, row: 5 },
}
