import Cells from '../../cells'
import type Types from '../types'

/**
 * Bars over such dates would rank days by size, which nobody asks for.
 *
 * @param column the column to judge
 * @returns whether all it holds is text that looks like dates
 */
export const hasUnreadDates = (column: Types.Column): boolean =>
  column.soleKind === 'text' &&
  (column.cellsByKind.get('text') ?? []).every(Cells.isLikeAnUnreadDate)
