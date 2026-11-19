import type Cells from '../../cells'

/**
 * A row of a table whose rows name their cells: the cell of each column, or
 * none.
 *
 * @param columns the names of the columns, in order
 * @param cells the cells of one record, by the name of their column
 * @returns one cell a column, null where the record names no such cell
 */
export const cellsUnder = (
  columns: string[],
  cells: Map<string, Cells.Cell>,
): Cells.Cell[] => columns.map(column => cells.get(column) ?? null)
