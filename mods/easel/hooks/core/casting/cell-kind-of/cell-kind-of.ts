import Cells from '../../cells'
import type Types from '../types'

/**
 * A year or an epoch counts as a number: only a request can name it as x.
 *
 * @param cell the cell to read
 * @returns the kind it reads as
 */
export function cellKindOf(cell: Cells.Cell): Types.CellKind {
  const numeric = Cells.readNumber(cell)
  const { kind } = numeric.kind === 'unread' ? Cells.readTime(cell) : numeric

  return kind === 'unread' ? 'text' : kind
}
