import type Lists from '../../../../lists'
import type Shapes from '../../../../shapes'
import Limits from '../../../limits'
import type Types from '../../../types'

/**
 * The rectangle of one part of a band, as tall as the rows of the band
 * less a margin above and one below.
 *
 * @param shape the band the part lies in
 * @param laid the part, with the column where it ends
 * @returns the corner, the size and the colour
 */
export const bandPartRect = (
  shape: Shapes.BandShape,
  laid: Lists.Placed<Shapes.BandPart>,
): Types.Rect => ({
  x: laid.end - laid.part.width,
  y: shape.at.y + Limits.STRIP_MARGIN,
  width: laid.part.width,
  height: shape.rows - Limits.ABOVE_AND_BELOW * Limits.STRIP_MARGIN,
  ink: laid.part.ink,
})
