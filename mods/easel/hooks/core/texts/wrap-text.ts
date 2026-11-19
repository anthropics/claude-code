import { truncateMiddle } from './truncate-middle'
import { widthOf } from './width-of'

/**
 * Breaks a string at its spaces into rows of a bounded width.
 *
 * @param text the string to wrap
 * @param maxWidth the most cells a row may take
 * @param maxWordWidth the most cells one word may take before it is cut
 * @returns the rows, at least one
 */
export function wrapText(
  text: string,
  maxWidth: number,
  maxWordWidth = maxWidth,
): string[] {
  const rows = ['']

  for (const longWord of text.split(' ')) {
    const word = truncateMiddle(longWord, maxWordWidth)
    const extendedRow = `${rows.at(-1)} ${word}`.trimStart()

    const isRoomLeft = widthOf(extendedRow) <= maxWidth || extendedRow === word

    isRoomLeft ? (rows[rows.length - 1] = extendedRow) : rows.push(word)
  }

  return rows
}
