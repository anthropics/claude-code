import type Shapes from '../../../../shapes'
import Limits from '../../../limits'

/**
 * Parts side by side, across the width from the left edge.
 *
 * @param top the scene's row that the band starts on
 * @param parts each part's width, middle and ink, from the left
 * @returns the shape
 */
export const bandOf = (
  top: number,
  parts: Shapes.BandShape['parts'],
): Shapes.BandShape => ({
  kind: 'band',
  at: { x: 0, y: top },
  rows: Limits.BAND_ROWS,
  parts,
})
