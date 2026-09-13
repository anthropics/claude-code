import type Git from '../../../hooks/git'
import { WIDE_LINE_LETTERS } from './wide-line-letters.js'

/**
 * A hunk of wide lines cycling context, removed and added: at its defaults
 * two share a `Code` and three do not.
 *
 * @param start the first line's number on both sides
 * @param count how many lines
 * @param letter the character each line repeats WIDE_LINE_LETTERS times
 * @returns the hunk
 */
export function wideHunk(start = 1, count = 40, letter = 'x'): Git.Hunk {
  const markers = [' ', '-', '+']

  return {
    oldStart: start,
    newStart: start,
    lines: Array.from(
      { length: count },
      (_, row) =>
        `${markers[row % markers.length]}${letter.repeat(WIDE_LINE_LETTERS)}`,
    ),
  }
}
