import type Shapes from '../../../shapes'
import Texts from '../../../texts'
import type Types from '../../types'

/**
 * Writes each grapheme from the left, as wide as the terminal draws it.
 *
 * The cells behind the first of a wide grapheme are empty, so that the row
 * still comes out as wide as its cells.
 *
 * @param canvas the cells to paint in
 * @param shape the words, their place and their ink
 * @returns nothing
 */
export function paintText(
  canvas: Types.Canvas,
  { at, text, ink }: Shapes.TextShape,
): void {
  let column = Math.round(at.x)

  for (const glyph of Texts.graphemesOf(text)) {
    const width = Texts.widthOf(glyph)
    canvas.set({ x: column, y: at.y }, { glyph, ink })

    for (let extra = 1; extra < width; extra++) {
      canvas.set({ x: column + extra, y: at.y }, { glyph: '', ink })
    }

    column += width
  }
}
