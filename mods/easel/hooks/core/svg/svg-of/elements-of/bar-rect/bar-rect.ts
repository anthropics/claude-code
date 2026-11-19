import type Shapes from '../../../../shapes'
import Limits from '../../../limits'
import type Types from '../../../types'

/**
 * The rectangle a bar fills: less than its row is tall, with the rest
 * shared above and below.
 *
 * @param shape the bar, placed and sized in cells
 * @returns the corner, the size and the colour
 */
export const barRect = (shape: Shapes.BarShape): Types.Rect => ({
  x: shape.at.x,
  y: shape.at.y + (1 - Limits.BAR_HEIGHT) / Limits.ABOVE_AND_BELOW,
  width: shape.width,
  height: Limits.BAR_HEIGHT,
  ink: shape.ink,
})
