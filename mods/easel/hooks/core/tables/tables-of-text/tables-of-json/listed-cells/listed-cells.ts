import type Cells from '../../../../cells'
import Json from '../../../../json'
import { cellOf } from '../../../cell-of'

/**
 * A listed row is a record keyed by the names of the columns, or a list in
 * their order.
 *
 * @param columns the names of the listed columns
 * @returns the step from one listed row to its cells
 */
export const listedCells =
  (columns: string[]) =>
  (row: unknown): Cells.Cell[] => {
    const isKeyed = Json.isRecord(row)

    return (
      isKeyed ? columns.map(name => row[name]) : Json.valuesAt(row, '[]')
    ).map(cellOf)
  }
