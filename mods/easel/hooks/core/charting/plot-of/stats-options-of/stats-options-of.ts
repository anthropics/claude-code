import type Types from '../../types'

/**
 * The stats are written beside the values on the axis, and a total is told
 * only of series that the call sums.
 *
 * @param options what one plot is drawn from
 * @param axisValues the values drawn on the value axis
 * @returns what the stats of the plot are made from
 */
export const statsOptionsOf = (
  options: Types.PlotOptions,
  axisValues: number[],
): Types.StatsOptions => ({
  seriesOfPlot: options.seriesOfPlot,
  axisValues,
  timeline: options.data.timeline,
  isSummed: options.request.combine === 'sum',
})
