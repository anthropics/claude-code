import type Charting from '../../../charting'
import { legendOf } from '../../legend-of'
import { legendRowOf } from '../../legend-row-of'
import type Types from '../../types'
import { BAR_LANE } from './bar-lane'
import { barOf } from './bar-of'

/**
 * Lays a legend row for each bar, and the bar in the row's lane.
 *
 * A bar of no length, or in a lane of no width, is not drawn.
 *
 * @param room the width to fill and the row of the first bar
 * @param rows the bars
 * @param headerTexts the texts that the header shows
 * @returns the rows and their bars, and the first row under them
 */
export function barsOf(
  room: Types.Room,
  rows: Charting.Bar[],
  headerTexts: string[],
): Types.Laid {
  const legend = legendOf({
    rows,
    columns: room.columns,
    lane: BAR_LANE,
    headerTexts,
    left: 0,
  })

  return {
    shapes: rows.flatMap((row, index) => {
      const laidRow = legendRowOf(legend, row, room.rows + index)
      const hasBar = row.relativeLength !== 0 && legend.laneWidth > 0

      return hasBar
        ? [...laidRow.shapes, barOf(laidRow.lane, row, legend)]
        : laidRow.shapes
    }),
    rows: room.rows + rows.length,
  }
}
