import type Types from '../../../types'
import Words from '../../../words'

/**
 * What every cell holds before a shape is painted.
 */
export const BLANK_CELL: Readonly<Types.CanvasCell> = {
  glyph: Words.BLANK,
  ink: 'words',
}
