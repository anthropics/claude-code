import type Types from '../../../../../types'

/**
 * Cuts a line at the spans of the columns.
 *
 * @param columns the spans of the columns, from left to right
 * @returns the cutter of one line into its cells, each one trimmed
 */
export const cellsOfLineIn =
  (columns: Types.Field[]) =>
  (line: string): string[] =>
    columns.map(field => line.slice(field.from, field.until).trim())
