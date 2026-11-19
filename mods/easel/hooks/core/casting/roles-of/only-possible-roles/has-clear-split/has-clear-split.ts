import type Types from '../../../types'

/**
 * Whether the texts beside x leave one way to split the marks: none of
 * them, or one where x repeats its cells.
 *
 * @param splitColumns the text columns that are not x
 * @param xColumn the column read as x
 * @returns whether the split is settled
 */
export const hasClearSplit = (
  splitColumns: Types.Column[],
  xColumn: Types.Column,
): boolean =>
  splitColumns.length === 0 ||
  (splitColumns.length === 1 &&
    new Set(xColumn.cells).size < xColumn.cells.length)
