import Cells from '../../../../../cells'
import Limits from '../../../../limits'

/**
 * Tells a table from prose that happens to line up.
 *
 * @param block the header line of cells, then the lines under it
 * @returns whether every cell under one name of at least two is a number
 */
export const hasNumberColumn = ([header = [], ...rows]: string[][]): boolean =>
  rows.length > 0 &&
  header.length >= Limits.MIN_ROW_CELLS &&
  [...header.keys()].some(columnIndex =>
    rows.every(
      row => Cells.readNumber(row[columnIndex] ?? '').kind === 'number',
    ),
  )
