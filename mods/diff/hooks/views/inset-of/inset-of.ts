import Limits from '../../limits'
import type { Kit } from '../kit'

/**
 * A drawing's kit inside the docked pane's padding: the built-in's blank
 * last column and its blank row above the header taken off.
 *
 * @param kit the drawing's kit at the pane's full size
 * @returns the kit its body draws with
 */
export const insetOf = (kit: Kit): Kit => ({
  ...kit,
  columns: Math.max(1, kit.columns - Limits.PANE_RIGHT_PAD_COLUMNS),
  rows: Math.max(0, kit.rows - Limits.PANE_TOP_PAD_ROWS),
})
