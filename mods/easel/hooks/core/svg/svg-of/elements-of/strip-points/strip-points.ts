import type Shapes from '../../../../shapes'
import Limits from '../../../limits'
import { pixelPoint } from '../../../pixel-point'
import { outlineOf } from './outline-of'

/**
 * The corners of a strip: along the line it stands on from its first
 * column, over the tops of its columns, and back down after the last.
 *
 * @param shape the strip, placed in cells
 * @returns the pixel points, with a space between two
 */
export function stripPoints(shape: Shapes.StripShape): string {
  const foot = shape.at.y + 1 - Limits.STRIP_MARGIN

  return (
    `${pixelPoint(shape.at.x, foot)} ` +
    `${outlineOf(shape, foot).join(' ')} ` +
    `${pixelPoint(shape.at.x + shape.heights.length, foot)}`
  )
}
