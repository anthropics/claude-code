import type Charting from '../../../charting'
import type Shapes from '../../../shapes'
import Texts from '../../../texts'
import { legendOf } from '../../legend-of'
import { legendRowOf } from '../../legend-row-of'
import Limits from '../../limits'
import { NO_LANE } from '../../no-lane'
import { textShapesOf } from '../../text-shapes-of'
import type Types from '../../types'
import { axisRowOf } from './axis-row-of'
import { columnsOf } from './columns-of'
import { flagOf } from './flag-of'
import { lineOf } from './line-of'
import { linesOf } from './lines-of'
import { timeAxisOf } from './time-axis-of'
import { toCellsOf } from './to-cells-of'

/**
 * Draws every plot under its legend rows, then the time axis under them all.
 *
 * A series that the header names has no legend row where its first stat does
 * not fit. A grid line starts in the middle of the value axis line's cell.
 *
 * @param options the room, the chart, where its plots stand and what the
 *   header shows
 * @returns the shapes, the first row under them and the notes to show
 */
export function plotsOf({
  room,
  chart,
  plotsLayout,
  headerTexts,
}: Types.PlotsToLay): Types.LaidPlots {
  const { area, drawnPlots } = plotsLayout
  const hasColumns = area.columnWidth > 0
  const legend = legendOf({
    rows: drawnPlots.flatMap((plot): Charting.LegendRow[] => plot.rows),
    columns: room.columns,
    lane: NO_LANE,
    headerTexts,
    left: area.left,
  })
  const hasLegend = legend.shownNames.size + legend.statColumns.length > 0
  const flags = chart.marks.map(flagOf(area))
  const seriesShapesOf = hasColumns ? columnsOf : linesOf
  const laid: Shapes.Shape[][] = []
  let freeRow = room.rows

  for (const plot of drawnPlots) {
    for (const row of hasLegend ? plot.rows : []) {
      const laidRow = legendRowOf(legend, row, freeRow)
      laid.push(laidRow.shapes)
      freeRow = laidRow.rows
    }

    const top = freeRow
    const bottom = top + plot.height

    for (let gridRow = top; gridRow < bottom; gridRow++) {
      const rowTick = plot.ticks.find(
        tick => top + Math.floor(plot.yOf(tick.position)) === gridRow,
      )
      const label = rowTick?.label ?? ''
      laid.push(
        textShapesOf({
          at: {
            x: area.left - Limits.VALUE_AXIS_WIDTH - Texts.widthOf(label),
            y: gridRow,
          },
          text: label,
          ink: 'quiet',
        }),
        [
          axisRowOf(
            { x: area.left - 1, y: gridRow },
            rowTick ? area.width + Limits.HALF_CELL : 0,
          ),
        ],
      )
    }

    laid.push(
      seriesShapesOf({
        rows: plot.rows,
        area,
        toCells: toCellsOf(area, plot, top),
      }),
    )

    for (const [row, keys] of plot.endKeys) {
      for (const [keyIndex, endKey] of keys.entries()) {
        laid.push(
          textShapesOf({
            at: {
              x: area.left + area.width + Limits.WORD_GAP + keyIndex,
              y: top + row,
            },
            text: endKey.key,
            ink: endKey.ink,
          }),
        )
      }
    }

    laid.push(
      flags.map(flag =>
        lineOf(
          [top, bottom - Limits.EDGE_INSET].map(lineEnd => ({
            x: flag.x,
            y: lineEnd,
          })),
          'quiet',
        ),
      ),
    )
    freeRow = bottom
  }

  const axis = timeAxisOf({
    room: { columns: room.columns, rows: freeRow },
    timeline: chart.timeline,
    area,
    flags,
  })
  const hasMergedColumns = chart.form === 'columns' && !hasColumns

  return {
    shapes: [...laid.flat(), ...axis.shapes],
    rows: axis.rows,
    notes: hasMergedColumns ? [chart.mergedColumnsNote] : [],
  }
}
