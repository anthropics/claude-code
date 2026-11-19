/**
 * A row of a list of rows is a list of plain values.
 *
 * @param row one item of the list
 * @returns whether it is such a list
 */
export const isRowOf = (row: unknown): row is unknown[] =>
  Array.isArray(row) &&
  !row.some(cell => typeof cell === 'object' && cell !== null)
