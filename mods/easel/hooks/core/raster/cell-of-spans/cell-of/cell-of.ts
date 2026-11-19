import type Shapes from '../../../shapes'
import type Types from '../../types'

/**
 * A cell in which two parts meet: one glyph over a second ink.
 *
 * @param glyph the block that the first part fills
 * @param ink the ink of the first part
 * @param background the ink of the second part, where there is one
 * @returns the cell
 */
export const cellOf = (
  glyph: string,
  ink: Shapes.Ink,
  background: Shapes.Ink | undefined,
): Types.CanvasCell => ({ glyph, ink, background })
