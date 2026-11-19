import type Shapes from '../../../../../shapes'
import Limits from '../../../../limits'
import { pixelPoint } from '../../../../pixel-point'

/**
 * One polygon is far shorter than its columns. A gap has no height.
 *
 * @param shape the strip, with the share of a row each column fills
 * @param foot the line the strip stands on, in rows
 * @returns the two top corners of each column, as pixel points
 */
export const outlineOf = (shape: Shapes.StripShape, foot: number): string[] =>
  shape.heights.flatMap((height, offset) => {
    const left = shape.at.x + offset
    const top =
      foot - (height ?? 0) * (1 - Limits.ABOVE_AND_BELOW * Limits.STRIP_MARGIN)

    return [pixelPoint(left, top), pixelPoint(left + 1, top)]
  })
