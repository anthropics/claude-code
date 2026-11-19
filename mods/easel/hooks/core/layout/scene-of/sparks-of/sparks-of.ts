import { legendOf } from '../../legend-of'
import { legendRowOf } from '../../legend-row-of'
import type Types from '../../types'
import { cellHeightsOf } from './cell-heights-of'
import { SPARK_LANE } from './spark-lane'
import { stripOf } from './strip-of'

/**
 * Lays a legend row for each series, and its spark in the row's lane.
 *
 * `MIN_CHART_COLUMNS` leaves room for the lane, so `laneWidth` is never 0.
 *
 * @param room the width to fill and the row of the first series
 * @param chart the series and the step between their samples
 * @param headerTexts the texts that the header shows
 * @returns the rows and their sparks, and the first row under them
 */
export function sparksOf(
  room: Types.Room,
  chart: Types.SparksChart,
  headerTexts: string[],
): Types.Laid {
  const legend = legendOf({
    rows: chart.rows,
    columns: room.columns,
    lane: SPARK_LANE,
    headerTexts,
    left: 0,
  })
  const slotCount = Math.min(
    legend.laneWidth,
    Math.round(1 / chart.medianStep) + 1,
  )

  return {
    shapes: chart.rows.flatMap((row, index) => {
      const laidRow = legendRowOf(legend, row, room.rows + index)

      return [
        ...laidRow.shapes,
        stripOf(laidRow.lane, cellHeightsOf(row, legend, slotCount), row.ink),
      ]
    }),
    rows: room.rows + chart.rows.length,
  }
}
