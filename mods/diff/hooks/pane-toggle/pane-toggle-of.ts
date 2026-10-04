import Limits from '../limits'
import type { PaneBelief } from './pane-belief'

/**
 * What `/diff` does, the one place its toggle is decided: close the open
 * pane; otherwise open it, unless the terminal is too narrow.
 *
 * Narrower than the built-in panel shows on, it answers the resize line
 * (`too-narrow`); a width not drawn yet opens.
 *
 * @param pane whether the pane is open, and the width
 * @returns `close`, `open` or `too-narrow`
 */
export function paneToggleOf(
  pane: PaneBelief,
): 'open' | 'close' | 'too-narrow' {
  const isTooNarrow =
    pane.columns !== null && pane.columns < Limits.OPEN_MIN_COLUMNS

  return pane.isOpen ? 'close' : isTooNarrow ? 'too-narrow' : 'open'
}
