import type Types from '../../types'
import { drawnPlotOf } from './drawn-plot-of'
import { keyColumnsOf } from './key-columns-of'
import { keyRoomOf } from './key-room-of'
import { plotAreaOf } from './plot-area-of'

/**
 * Columns must fit beside one key. Lines leave room for the most in a row.
 *
 * @param chart the chart's form, its plots and its time
 * @param sceneColumns the cells that the scene has across
 * @returns the area that all plots share, and each plot as it is drawn
 */
export function plotsLayoutOf(
  chart: Types.PlottedChart,
  sceneColumns: number,
): Types.PlotsLayout {
  const plots = chart.plots
  const columnArea = plotAreaOf(
    plots,
    sceneColumns - keyColumnsOf(plots),
    chart.timeline.periodStarts.length,
  )
  const hasColumns = columnArea.columnWidth > 0
  const drawnPlots = plots.map(plot => drawnPlotOf(plot, chart, hasColumns))

  return hasColumns
    ? { area: columnArea, drawnPlots }
    : {
        area: plotAreaOf(plots, sceneColumns - keyRoomOf(drawnPlots), 0),
        drawnPlots,
      }
}
