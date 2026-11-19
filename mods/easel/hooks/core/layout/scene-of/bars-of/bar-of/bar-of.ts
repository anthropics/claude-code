import type Charting from '../../../../charting'
import type Shapes from '../../../../shapes'
import Limits from '../../../limits'
import type Types from '../../../types'

/**
 * One row's bar. It shows `MIN_INK` at least; one below zero is hatched.
 *
 * @param at where the row's lane starts
 * @param row the bar's length, as a share of the lane, and its ink
 * @param legend how wide the lane is
 * @returns the shape
 */
export const barOf = (
  at: Shapes.Point,
  row: Charting.Bar,
  legend: Types.Legend,
): Shapes.BarShape => ({
  kind: 'bar',
  at,
  width: Math.max(
    Limits.MIN_INK,
    Math.abs(row.relativeLength) * legend.laneWidth,
  ),
  ink: row.ink,
  isHatched: row.relativeLength < 0,
})
