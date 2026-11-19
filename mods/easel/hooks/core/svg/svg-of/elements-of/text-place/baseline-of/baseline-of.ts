import type Shapes from '../../../../../shapes'
import Limits from '../../../../limits'

/**
 * How far down the letters of a line of words stand, measured from the
 * middle of their row.
 *
 * @param shape the line of words, placed in cells
 * @returns the baseline, in pixels from the top
 */
export const baselineOf = (shape: Shapes.TextShape): number =>
  (shape.at.y + Limits.CELL_MIDDLE) * Limits.CELL_HEIGHT + Limits.BASELINE
