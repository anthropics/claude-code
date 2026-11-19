import Cells from '../../../../../cells'

/**
 * Reads a time as a number, so that two instants compare whatever their
 * spelling.
 *
 * @param cell the cell to read, null where the row has none
 * @returns its epoch milliseconds, or undefined where it is no time
 */
export function msOf(cell: Cells.Cell = null): number | undefined {
  const time = Cells.readTime(cell)

  return time.kind === 'time' ? time.ms : undefined
}
