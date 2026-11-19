import Charting from '../../../../charting'
import type Shapes from '../../../../shapes'
import Limits from '../../../limits'
import { textShapesOf } from '../../../text-shapes-of'

/**
 * A fact on the last row, after what that row already holds.
 *
 * The x stands in for the blank that the separator starts with.
 *
 * @param rows the first row that is free, one under the row to join
 * @param usedWidth the cells of the row that are taken
 * @param text the fact
 * @returns the one shape, or none
 */
export const joinedTextShapesOf = (
  rows: number,
  usedWidth: number,
  text: string,
): Shapes.Shape[] =>
  textShapesOf({
    at: { x: usedWidth + Limits.WORD_GAP, y: rows - 1 },
    text: `${Charting.SEPARATOR.trimStart()}${text}`,
    ink: 'quiet',
  })
