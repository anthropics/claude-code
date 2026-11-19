import type Cells from '../../cells'

/**
 * One value at the end of a path of keys in a record, under its column.
 */
export type Leaf = {
  column: string
  cell: Cells.Cell

  /**
   * True for a list of records or lists, which is not read: `cell` is null.
   */
  isList: boolean
}
