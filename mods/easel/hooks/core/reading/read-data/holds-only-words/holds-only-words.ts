import type Casting from '../../../casting'
import Cells from '../../../cells'
import Patterns from '../../patterns'

/**
 * A table with no cell that may be a number or a time, as a list of column
 * types is. Left out of a chart, it leaves no data out.
 *
 * A cell that opens like a number or reads as a date counts, in any spelling.
 *
 * @param table a table of the result
 * @returns whether each of its cells is empty or a plain word
 */
export function holdsOnlyWords({
  rows,
  listColumns = [],
}: Casting.Table): boolean {
  return (
    listColumns.length === 0 &&
    rows.every(row =>
      row.every(
        cell =>
          cell === null ||
          !(
            Patterns.OPENS_LIKE_A_NUMBER.test(String(cell)) ||
            Cells.isLikeAnUnreadDate(cell) ||
            Cells.readTime(cell).kind === 'time'
          ),
      ),
    )
  )
}
