import Casting from '../../casting'
import Texts from '../../texts'
import { columnLineOf } from './column-line-of'
import { headingOf } from './heading-of'

/**
 * Makes the reader of one table's part of the summary: a line for each
 * column up to the cap, under the table's heading where one is asked for.
 *
 * @param maxColumns how many columns of one table are listed
 * @param isHeaded whether each table's lines come under its heading
 * @returns what turns a table into its lines
 */
export const tableLinesOf =
  (maxColumns: number, isHeaded: boolean) =>
  (table: Casting.Table): string[] => {
    const shownLines = Texts.capped(
      Casting.classifiedColumns(table).map(column =>
        columnLineOf(column, table.listColumns),
      ),
      maxColumns,
      'more column',
    )

    return isHeaded ? [headingOf(table), ...shownLines] : shownLines
  }
