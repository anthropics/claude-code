import { dataFill } from '../../../data-fill'
import { pixelsAcross } from '../../../pixels-across'
import { pixelsDown } from '../../../pixels-down'
import type Types from '../../../types'

/**
 * One rectangle of the data, placed and sized in pixels.
 *
 * @param rect the corner, the size and the colour
 * @param attributes more to write, each starting with a space
 * @returns the element
 */
export const rectElement = (rect: Types.Rect, attributes = ''): string =>
  `<rect x="${pixelsAcross(rect.x)}" y="${pixelsDown(rect.y)}" ` +
  `width="${pixelsAcross(rect.width)}" height="${pixelsDown(rect.height)}" ` +
  `${dataFill(rect.ink, attributes)}/>`
