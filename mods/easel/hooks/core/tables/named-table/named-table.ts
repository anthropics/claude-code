import type Casting from '../../casting'
import type Cells from '../../cells'

/**
 * A table read whole, under the names it came with.
 *
 * @param source the name the table carries as its source
 * @param columns the names of the columns
 * @param rows the cells of each row, by column
 * @returns the table, neither cut nor with made-up names
 */
export const namedTable = (
  source: string,
  columns: string[],
  rows: Cells.Cell[][],
): Casting.Table => ({
  source,
  columns,
  rows,
  hasMadeUpNames: false,
  isCut: false,
})
