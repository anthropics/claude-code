import Limits from '../../../hooks/limits'
import type Views from '../../../hooks/views'

/**
 * A pane seated inline on a terminal one column short of the built-in
 * panel's width.
 */
export const NARROW_SEAT: Views.PaneSeat = {
  placement: 'inline',
  terminalColumns: Limits.OPEN_MIN_COLUMNS - 1,
}
