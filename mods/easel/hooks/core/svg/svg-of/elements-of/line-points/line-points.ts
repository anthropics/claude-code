import type Shapes from '../../../../shapes'
import { pixelPoint } from '../../../pixel-point'

/**
 * Every place a stroke runs through, in the order they are listed.
 *
 * @param shape the stroke, with its places in cells
 * @returns the pixel points, with a space between two
 */
export const linePoints = (shape: Shapes.LineShape): string =>
  shape.points.map(point => pixelPoint(point.x, point.y)).join(' ')
