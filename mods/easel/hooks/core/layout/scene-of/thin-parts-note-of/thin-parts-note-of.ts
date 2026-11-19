import Texts from '../../../texts'
import type Types from '../../types'
import { noteLineOf } from './note-line-of'

/**
 * Says below everything else that thin parts may be left out.
 *
 * Last, so that a painter that leaves no part out can end before it.
 *
 * @param room the width to wrap to and the row of the first line
 * @param note the words to wrap to the width
 * @returns the lines, and the first row under them
 */
export function thinPartsNoteOf(room: Types.Room, note: string): Types.Laid {
  const lines = Texts.wrapText(note, room.columns)

  return {
    shapes: lines.map((text, index) => noteLineOf(text, room.rows + index)),
    rows: room.rows + lines.length,
  }
}
