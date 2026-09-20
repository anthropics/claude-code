/**
 * The name a row was sent under, as rowsOf reads the row back; undefined
 * for a value that is no row.
 *
 * @param row one of rowsOf's rows
 * @returns the name the row was sent under
 */
export function eventNameOf(row: unknown): unknown {
  const isRow = typeof row === 'object' && row !== null && 'event_name' in row

  return isRow ? row.event_name : undefined
}
