/**
 * The cells to the right of the value axis, where the series are drawn.
 */
export type PlotArea = {
  /**
   * The first cell to the right of the value axis.
   */
  left: number

  width: number

  /**
   * It is 0 where lines are drawn.
   */
  columnWidth: number

  /**
   * From a share of the time axis to its x.
   */
  xOf: (position: number) => number

  /**
   * On a column chart, the middle of the column of the position's period.
   */
  tickXOf: (position: number) => number
}
