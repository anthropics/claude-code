import type Types from '../types'

/**
 * What a table is called where it is shown: its place inside other JSON
 * where it has one, else the word for its format.
 *
 * @param table a table, or the data read from one
 * @returns the path, or the source where there is no path
 */
export const shownSourceOf = (
  table: Pick<Types.Table, 'source' | 'path'>,
): string => table.path ?? table.source
