import type Shapes from '../../../../shapes'

/**
 * One row of the value axis: its piece of the axis line, and a grid line
 * where the row has a tick.
 *
 * @param at the cell of the axis line in this row
 * @param gridWidth how far the grid line runs from the axis; 0 draws none
 * @returns the shape
 */
export const axisRowOf = (
  at: Shapes.Point,
  gridWidth: number,
): Shapes.AxisRowShape => ({ kind: 'axisRow', at, gridWidth })
