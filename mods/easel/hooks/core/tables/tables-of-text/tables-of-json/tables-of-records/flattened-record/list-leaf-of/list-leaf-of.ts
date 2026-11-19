import type Types from '../../../../../types'

/**
 * A list of records or lists at the end of a path of keys: it is not read.
 *
 * @param column the keys that lead to the list, joined by dots
 * @returns the leaf, with no cell
 */
export const listLeafOf = (column: string): Types.Leaf => ({
  column,
  cell: null,
  isList: true,
})
