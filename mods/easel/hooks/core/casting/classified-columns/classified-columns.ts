import type Types from '../types'
import { classifiedColumn } from './classified-column'

/**
 * Sorts the cells under each name of the header by the kind they read as,
 * a missing cell of a short row as an empty one.
 *
 * @param table the names of the header and the rows under it
 * @returns one entry for each name, in the order of the header
 */
export const classifiedColumns = (table: Types.Table): Types.Column[] =>
  table.columns.map((name, columnIndex) =>
    classifiedColumn(
      name,
      table.rows.map(row => row[columnIndex] ?? null),
    ),
  )
