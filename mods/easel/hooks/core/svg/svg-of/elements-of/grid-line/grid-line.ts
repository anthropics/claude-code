import type Shapes from '../../../../shapes'
import Limits from '../../../limits'
import { quietLine } from '../quiet-line'

/**
 * The line of the grid at a tick: from the middle of the cell of the axis,
 * through the middle of the row.
 *
 * @param shape the row of the axis, with how far its grid line runs
 * @returns the element
 */
export function gridLine(shape: Shapes.AxisRowShape): string {
  const left = shape.at.x + Limits.CELL_MIDDLE
  const middle = shape.at.y + Limits.CELL_MIDDLE

  return quietLine(
    { x: left, y: middle },
    { x: left + shape.gridWidth, y: middle },
    ' class="grid"',
  )
}
