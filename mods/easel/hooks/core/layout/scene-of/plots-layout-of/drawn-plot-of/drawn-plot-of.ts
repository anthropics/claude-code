import type Charting from '../../../../charting'
import Limits from '../../../limits'
import { snapped } from '../../../snapped'
import type Types from '../../../types'
import { endKeysOf } from './end-keys-of'
import { rowsPerStepOf } from './rows-per-step-of'
import { ticksAtInk } from './ticks-at-ink'
import { unstacked } from './unstacked'

/**
 * The scale does not depend on the width. Rows are counted down from the top
 * tick, before any cropping.
 *
 * Rows beyond the ink are cropped where that leaves two ticks or more. Lines
 * drawn where columns do not fit stand on zero too, and show each series' own
 * values, as its legend row states them.
 *
 * @param plot the plot to draw
 * @param chart the chart's form, and the plots that share the scene
 * @param hasColumns whether the columns that the form asks for fit the scene
 * @returns the plot with its scale, its height and the keys at its lines' ends
 */
export function drawnPlotOf(
  plot: Charting.Plot,
  chart: Types.PlottedChart,
  hasColumns: boolean,
): Types.DrawnPlot {
  const isColumnChart = chart.form === 'columns'
  const rows = isColumnChart && !hasColumns ? unstacked(plot.rows) : plot.rows
  const values = rows
    .flatMap(row => row.stretches.flat())
    .map(sample => sample.y)
  const lowest = isColumnChart ? 0 : Math.min(...values)
  const highest = Math.max(...values)
  const stepCount = plot.ticks.length - 1
  const isCropped =
    ticksAtInk(plot, lowest, highest).length >= Limits.MIN_TICKS_TO_CROP
  const bottom = isCropped ? lowest : 0
  const top = isCropped ? highest : 1
  const hasSpread = highest > lowest
  const rowsPerStep = hasSpread
    ? rowsPerStepOf(chart.plots.length, (top - bottom) * stepCount)
    : 1
  const rowsDown = (position: number): number =>
    snapped((1 - position) * stepCount * rowsPerStep)
  const rowOf = (position: number): number => Math.round(rowsDown(position))
  const yOf = (position: number): number =>
    Limits.HALF_CELL + rowsDown(position) - rowOf(top)

  return {
    ...plot,
    rows,
    yOf,
    height: rowOf(bottom) - rowOf(top) + 1,
    endKeys: endKeysOf(hasColumns ? [] : rows, yOf),
  }
}
