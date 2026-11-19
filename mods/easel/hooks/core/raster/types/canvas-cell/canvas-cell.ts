import type Shapes from '../../../shapes'
import type { LineBits } from '../line-bits'

/**
 * At most one of `background` and `lines` is set.
 */
export type CanvasCell = {
  /**
   * One grapheme, or an empty text behind the first cell of a wide one.
   */
  glyph: string

  ink: Shapes.Ink

  /**
   * The ink of the rest of the cell, where two parts meet inside it.
   */
  background?: Shapes.Ink

  /**
   * The braille bits of each line that passes, in the order of painting.
   */
  lines?: LineBits[]
}
