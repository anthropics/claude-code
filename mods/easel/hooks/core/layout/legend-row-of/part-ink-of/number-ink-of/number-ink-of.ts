import type Charting from '../../../../charting'
import type Shapes from '../../../../shapes'
import type Types from '../../../types'

/**
 * Picks the ink of a stat's number: the row's, or the title's where a lane
 * already shows the row's ink.
 *
 * @param legend where every part of every row stands
 * @param row the row that the number belongs to
 * @returns the ink to lay the number in
 */
export const numberInkOf = (
  legend: Types.Legend,
  row: Charting.LegendRow,
): Shapes.Ink => (legend.wantsLane ? 'title' : row.ink)
