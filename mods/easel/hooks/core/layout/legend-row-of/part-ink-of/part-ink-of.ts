import type Charting from '../../../charting'
import type Shapes from '../../../shapes'
import Limits from '../../limits'
import type Types from '../../types'
import { numberInkOf } from './number-ink-of'

/**
 * Picks the ink of one part of a stat: quiet, but for the number.
 *
 * @param legend where every part of every row stands
 * @param row the row that the stat belongs to
 * @param partIndex which part of the stat it is
 * @returns the ink to lay the part in
 */
export const partInkOf = (
  legend: Types.Legend,
  row: Charting.LegendRow,
  partIndex: number,
): Shapes.Ink =>
  partIndex === Limits.NUMBER_PART_INDEX ? numberInkOf(legend, row) : 'quiet'
