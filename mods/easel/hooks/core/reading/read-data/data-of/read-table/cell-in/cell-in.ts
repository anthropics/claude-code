import type Cells from '../../../../../cells'

/**
 * Reads a row by the name of a column. A name the table lacks, like a row
 * too short to reach it, reads as an empty cell.
 *
 * @param indexes where each named column stands in a row
 * @returns what reads the cell under a name in one row
 */
export const cellIn =
  (indexes: Map<string, number>) =>
  (column: string, row: Cells.Cell[]): Cells.Cell => {
    const index = indexes.get(column)

    return index === undefined ? null : (row[index] ?? null)
  }
