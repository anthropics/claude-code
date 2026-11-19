import Casting from '../../../../casting'
import Json from '../../../../json'
import Limits from '../../../limits'
import { namedTable } from '../../../named-table'
import Words from '../../../words'
import { cellsOfRow } from './cells-of-row'
import { isRowOf } from './is-row-of'

/**
 * The rows of a spreadsheet, with the names in the first.
 *
 * A spreadsheet leaves the empty cells at the end of a row out, of the first
 * row too: the widest row says how many columns there are.
 *
 * @param lists the items of the list of rows
 * @param path the keys that lead to the list, joined by dots
 * @returns the one table, or none where the first row holds no names
 */
export function tablesOfRowLists(
  lists: unknown[],
  path: string,
): Casting.Table[] {
  const width = lists.reduce<number>(
    (widest, row) => Math.max(widest, Json.valuesAt(row, '[]').length),
    0,
  )
  const areRows =
    lists.length >= Limits.MIN_BLOCK_LINES &&
    width >= Limits.MIN_ROW_CELLS &&
    !Casting.isTooLarge(width, lists.length) &&
    lists.every(isRowOf)

  if (!areRows) {
    return []
  }

  const [header = [], ...rows] = lists.map(cellsOfRow(width))
  const table = namedTable(
    Words.JSON_SOURCE,
    header.map(name => String(name ?? '')),
    rows,
  )
  const isHeaded = Casting.hasHeaderRow(Casting.classifiedColumns(table))

  return isHeaded ? [{ ...table, path }] : []
}
