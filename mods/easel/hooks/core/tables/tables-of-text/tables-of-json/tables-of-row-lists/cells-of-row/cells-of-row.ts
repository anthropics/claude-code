import type Cells from '../../../../../cells'
import Lists from '../../../../../lists'
import { cellOf } from '../../../../cell-of'

/**
 * The cells of a row, with none wherever the row ends early.
 *
 * @param width the length of the widest row
 * @returns the cells of one row, as many as the widest row has
 */
export const cellsOfRow =
  (width: number) =>
  (row: unknown[]): Cells.Cell[] =>
    Lists.indexesBelow(width).map(index => cellOf(row[index]))
