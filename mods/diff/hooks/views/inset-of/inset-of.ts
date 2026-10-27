import Limits from '../../limits'
import type { Kit } from '../kit'

/**
 * A drawing's kit inside the docked pane's padding: the built-in's blank
 * last column taken off.
 *
 * No row comes off: the blank row above the header is the engine's own,
 * the one it keeps over a docked pane's body for its close mark.
 *
 * @param kit the drawing's kit at the pane's full size
 * @returns the kit its body draws with
 */
export const insetOf = (kit: Kit): Kit => ({
  ...kit,
  columns: Math.max(1, kit.columns - Limits.PANE_RIGHT_PAD_COLUMNS),
})
