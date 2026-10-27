import { cellWidth } from '../cell-width'

/**
 * A line cut into rows as Ink's `wrap` cuts the built-in's empty state
 * before it centers each row.
 *
 * It cuts at spaces, keeping the space a row breaks on at its end; a word
 * wider than a row is cut across rows.
 *
 * @param text one sanitized line
 * @param columns the width, at least one cell; no row holds more
 * @returns the rows, at least one
 */
export function wrappedLines(text: string, columns: number): string[] {
  const width = Math.max(1, columns)
  const rows: string[] = ['']
  const words = text.split(' ')

  for (const [index, word] of words.entries()) {
    const wordWidth = cellWidth(word)

    let rowWidth = cellWidth(rows[rows.length - 1] ?? '')

    if (index !== 0) {
      if (rowWidth >= width) {
        rows.push('')
        rowWidth = 0
      }

      rows[rows.length - 1] += ' '
      rowWidth += 1
    }

    if (wordWidth > width) {
      const breaksHere =
        1 + Math.floor((wordWidth - (width - rowWidth) - 1) / width)

      if (Math.floor((wordWidth - 1) / width) < breaksHere) {
        rows.push('')
      }

      const characters = [...word]

      let visible = cellWidth(rows[rows.length - 1] ?? '')

      for (const [at, character] of characters.entries()) {
        const characterWidth = cellWidth(character)

        if (visible + characterWidth <= width) {
          rows[rows.length - 1] += character
        } else {
          rows.push(character)
          visible = 0
        }

        visible += characterWidth

        if (visible === width && at < characters.length - 1) {
          rows.push('')
          visible = 0
        }
      }

      continue
    }

    if (rowWidth + wordWidth > width && rowWidth > 0 && wordWidth > 0) {
      rows.push('')
    }

    rows[rows.length - 1] += word
  }

  return rows
}
