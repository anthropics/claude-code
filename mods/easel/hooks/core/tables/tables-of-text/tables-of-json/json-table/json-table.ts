import type Casting from '../../../../casting'
import type Cells from '../../../../cells'
import Words from '../../../words'

/**
 * A table whose columns are the lists of one JSON record.
 *
 * @param path the keys that lead to the record, joined by dots, if any
 * @param columns the keys of the record
 * @param rows the cells of each row, by column
 * @returns the table, neither cut nor with made-up names
 */
export const jsonTable = (
  path: string | undefined,
  columns: string[],
  rows: Cells.Cell[][],
): Casting.Table => ({
  source: Words.JSON_SOURCE,
  path,
  columns,
  rows,
  hasMadeUpNames: false,
  isCut: false,
})
