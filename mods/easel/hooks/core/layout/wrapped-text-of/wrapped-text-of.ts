import type Shapes from '../../shapes'
import Texts from '../../texts'
import { textShapesOf } from '../text-shapes-of'
import type Types from '../types'

/**
 * Lays each paragraph on rows of its own, wrapped to the width. A blank
 * line takes its row and makes no shape.
 *
 * @param room the width to wrap to and the row of the first line
 * @param texts the words, one paragraph each
 * @param ink the ink of every line
 * @returns the lines, and the first row under them
 */
export function wrappedTextOf(
  room: Types.Room,
  texts: string[],
  ink: Shapes.Ink,
): Types.Laid {
  const lines = texts.flatMap(text => Texts.wrapText(text, room.columns))

  return {
    shapes: lines.flatMap((line, index) =>
      textShapesOf({ at: { x: 0, y: room.rows + index }, text: line, ink }),
    ),
    rows: room.rows + lines.length,
  }
}
