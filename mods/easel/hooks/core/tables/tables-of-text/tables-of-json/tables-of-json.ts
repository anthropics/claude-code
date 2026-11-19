import Casting from '../../../casting'
import Json from '../../../json'
import Lists from '../../../lists'
import Wire from '../../../wire'
import { cellOf } from '../../cell-of'
import Limits from '../../limits'
import { namedTable } from '../../named-table'
import type Types from '../../types'
import Words from '../../words'
import { isColumnOf } from './is-column-of'
import { jsonTable } from './json-table'
import { listedCells } from './listed-cells'
import { tablesOfRecords } from './tables-of-records'
import { tablesOfRowLists } from './tables-of-row-lists'
import { withLineRoles } from './with-line-roles'

/**
 * A table of metrics with enough times for a line states its own roles.
 *
 * Every column that is neither the time nor a value is a label of a series.
 * SQL APIs list `columns`, as names or records with a `name`, beside `rows`.
 * Google Sheets lists `values` by rows beside their `range`.
 *
 * @param root a JSON value: a text, a list or a record
 * @param ofText the reading of a text that a value turns out to be
 * @param place the keys that lead to the value and its source, if any
 * @returns the tables found in the value and beneath it
 */
export function tablesOfJson(
  root: unknown,
  ofText: (text: string) => Casting.Table[],
  place: Types.JsonPlace = {},
): Casting.Table[] {
  const { path, source = Words.JSON_SOURCE } = place

  if (typeof root === 'string') {
    return ofText(root)
  }

  if (typeof root !== 'object' || root === null) {
    return []
  }

  const metrics = Wire.metricsIn(root)

  if (metrics) {
    const tables = tablesOfRecords(metrics.points, metrics.source)
    const hasFewTimes =
      Lists.distinct(metrics.points.map(point => point.time)).length <
      Casting.MIN_TIMES_FOR_A_LINE

    return hasFewTimes ? tables : tables.map(withLineRoles(metrics))
  }

  const columns = Json.valuesAt(root, 'columns.[]').map(column =>
    String(Json.valuesAt(column, 'name')[0] ?? column),
  )
  const listedRows = Json.valuesAt(root, 'rows.[]')
  const hasListedColumns =
    columns.length > 0 && !Casting.isTooLarge(columns.length, listedRows.length)

  if (hasListedColumns) {
    return [
      namedTable(
        Words.LISTED_SOURCE,
        columns,
        listedRows.map(listedCells(columns)),
      ),
    ]
  }

  const isSheetByRows =
    typeof Json.valuesAt(root, 'range')[0] === 'string' &&
    Json.valuesAt(root, 'majorDimension')[0] === 'ROWS'

  if (isSheetByRows) {
    return tablesOfRowLists(
      Json.valuesAt(root, 'values.[]'),
      path === undefined ? 'values' : `${path}.values`,
    )
  }

  if (Array.isArray(root)) {
    const areRecords = root.length > 0 && root.every(Json.isRecord)

    return areRecords ? tablesOfRecords(root, source, path) : []
  }

  const lists = Object.values(root)
  const rowCount = Json.valuesAt(lists[0], '[]').length
  const areColumns =
    lists.length >= Limits.MIN_ROW_CELLS && lists.every(isColumnOf(rowCount))

  return areColumns
    ? [
        jsonTable(
          path,
          Object.keys(root),
          Lists.indexesBelow(rowCount).map(rowIndex =>
            lists.map(list => cellOf(list[rowIndex])),
          ),
        ),
      ]
    : Object.entries(root).flatMap(([key, value]) =>
        tablesOfJson(value, ofText, {
          path: path === undefined ? key : `${path}.${key}`,
        }),
      )
}
