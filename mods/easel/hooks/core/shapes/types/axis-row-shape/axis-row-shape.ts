import type { Point } from '../point'

/**
 * One row of the axis, with the grid line of its tick if the row has one.
 */
export type AxisRowShape = {
  kind: 'axisRow'
  at: Point

  /**
   * From the axis, through the middle of the row. 0 in a row with no tick.
   */
  gridWidth: number
}
