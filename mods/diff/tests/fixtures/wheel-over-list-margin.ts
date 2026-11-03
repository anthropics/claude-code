import type { UiScrollInput } from 'claude-code'

import { WHEEL_TICK } from './wheel-tick.js'

/**
 * The same wheel tick with the pointer over the blank row between the
 * docked header and its list.
 */
export const WHEEL_OVER_LIST_MARGIN: UiScrollInput = {
  ...WHEEL_TICK,
  pointer: { column: 10, row: 1 },
}
