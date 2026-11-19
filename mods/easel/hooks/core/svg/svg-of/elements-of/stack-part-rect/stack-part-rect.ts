import type Lists from '../../../../lists'
import type Shapes from '../../../../shapes'
import Limits from '../../../limits'
import type Types from '../../../types'

/**
 * The rectangle of one part of a stacked column, a hairline narrower than
 * the column so that neighbours stand apart.
 *
 * @param shape the column the part stands in
 * @param laid the part, with the row where it ends
 * @returns the corner, the size and the colour
 */
export const stackPartRect = (
  shape: Shapes.StackShape,
  laid: Lists.Placed<Shapes.StackPart>,
): Types.Rect => ({
  x: shape.at.x,
  y: laid.end,
  width: shape.width - Limits.HAIRLINE,
  height: laid.part.height,
  ink: laid.part.ink,
})
