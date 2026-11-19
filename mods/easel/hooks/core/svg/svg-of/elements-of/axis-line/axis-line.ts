import type Shapes from '../../../../shapes'
import Limits from '../../../limits'
import { quietLine } from '../quiet-line'

/**
 * The stretch of the axis that crosses one row, down the middle of the
 * cell of the axis.
 *
 * @param shape the row of the axis, placed in cells
 * @returns the element
 */
export function axisLine(shape: Shapes.AxisRowShape): string {
  const middle = shape.at.x + Limits.CELL_MIDDLE

  return quietLine(
    { x: middle, y: shape.at.y },
    { x: middle, y: shape.at.y + 1 },
  )
}
