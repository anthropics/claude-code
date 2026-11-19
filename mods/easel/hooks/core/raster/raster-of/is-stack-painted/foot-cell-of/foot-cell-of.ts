import Limits from '../../../limits'
import type Types from '../../../types'

/**
 * The cell in which a stack starts shows its upper half, or a thin line
 * where the stack is low.
 *
 * @param cell the cell that the parts of the stack give at its foot
 * @param eighths how high the stack stands over its foot, in eighths
 * @returns the cell to paint at the foot, in the ink of the first
 */
export const footCellOf = (
  cell: Types.CanvasCell,
  eighths: number,
): Types.CanvasCell => ({
  glyph: eighths < Limits.MIN_HALF_BLOCK_EIGHTHS ? '━' : '▀',
  ink: cell.ink,
})
