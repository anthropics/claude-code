import type Charting from '../../../../charting'
import Limits from '../../../limits'
import { maxWidthOf } from '../../../max-width-of'
import type Types from '../../../types'
import { columnAreaOf } from './column-area-of'
import { lineAreaOf } from './line-area-of'

/**
 * A count of 0 periods asks for lines. So do more periods than cells.
 *
 * The last sample of a line stands in the middle of the last cell. The last
 * cell of a period stays blank, unless it is the only one.
 *
 * @param plots the plots, whose tick labels stand left of the area
 * @param freeColumns the cells that the labels and the area may take
 * @param periodCount the periods to draw as columns, or 0 for lines
 * @returns where the area stands, and the way from a position to its x
 */
export function plotAreaOf(
  plots: Charting.Plot[],
  freeColumns: number,
  periodCount: number,
): Types.PlotArea {
  const left =
    maxWidthOf(plots.flatMap(plot => plot.ticks.map(tick => tick.label))) +
    Limits.VALUE_AXIS_WIDTH
  const freeWidth = freeColumns - left
  const columnPitch = periodCount > 0 ? Math.floor(freeWidth / periodCount) : 0
  const isForLines = columnPitch === 0

  return isForLines
    ? lineAreaOf(left, freeWidth)
    : columnAreaOf(left, columnPitch, periodCount)
}
