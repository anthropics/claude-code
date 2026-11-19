import type Types from '../../../types'

/**
 * Makes the way from a sample of one plot to its place in the scene: across
 * by the area's time axis, down from the plot's first row by its scale.
 *
 * @param area the cells of the series, which give a share of time its x
 * @param plot the plot at its drawn scale
 * @param top the first row of the plot
 * @returns the way from a sample, in shares of both axes, to cells and rows
 */
export const toCellsOf =
  (area: Types.PlotArea, plot: Types.DrawnPlot, top: number): Types.ToCells =>
  sample => ({ x: area.xOf(sample.x), y: top + plot.yOf(sample.y) })
