import type Types from '../../../types'

/**
 * A run starts as one cell: its glyph in its two inks.
 *
 * @param cell the cell that no run before it takes in
 * @returns the run of that cell alone
 */
export const runOf = (cell: Types.CanvasCell): Types.Run => ({
  text: cell.glyph,
  ink: cell.ink,
  background: cell.background,
})
