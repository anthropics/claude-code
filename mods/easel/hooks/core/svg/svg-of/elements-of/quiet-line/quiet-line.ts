import type Shapes from '../../../../shapes'
import { pixelsAcross } from '../../../pixels-across'
import { pixelsDown } from '../../../pixels-down'

/**
 * A straight line in the quiet ink, such as an axis or a line of the grid.
 *
 * @param origin where it starts, in cells
 * @param to where it ends, in cells
 * @param attributes more to write, each starting with a space
 * @returns the element
 */
export const quietLine = (
  origin: Shapes.Point,
  to: Shapes.Point,
  attributes = '',
): string =>
  `<line${attributes} ` +
  `x1="${pixelsAcross(origin.x)}" y1="${pixelsDown(origin.y)}" ` +
  `x2="${pixelsAcross(to.x)}" y2="${pixelsDown(to.y)}" ` +
  `stroke="var(--quiet)"/>`
