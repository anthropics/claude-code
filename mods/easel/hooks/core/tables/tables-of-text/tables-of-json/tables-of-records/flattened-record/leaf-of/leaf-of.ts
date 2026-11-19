import type Cells from '../../../../../../cells'
import type Types from '../../../../../types'

/**
 * One plain value at the end of a path of keys in a record.
 *
 * @param column the keys that lead to the value, joined by dots
 * @param cell the value as a cell
 * @returns the leaf, which is no list
 */
export const leafOf = (column: string, cell: Cells.Cell): Types.Leaf => ({
  column,
  cell,
  isList: false,
})
