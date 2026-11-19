import Cells from '../../../../../../cells'

/**
 * Whether a call that names the column as x would read times in it.
 *
 * Only an epoch names an instant. A year is read as a time too, but most
 * numbers of four digits are no years, so the summary does not offer it.
 *
 * @param numbers the numbers of one column
 * @returns whether each of them names an instant
 */
export const isReadAsTimes = (numbers: Cells.Cell[]): boolean =>
  numbers
    .map(cell => Cells.readTime(cell))
    .every(time => time.kind === 'time' && time.isZoned)
