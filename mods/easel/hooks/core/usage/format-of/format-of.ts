import type Casting from '../../casting'
import Tables from '../../tables'
import { tokenOf } from '../token-of'
import Words from '../words'

/**
 * Tells telemetry what a table was read from, never in a word of the data.
 *
 * @param table a table, or the data read from one
 * @returns the word for its source, or the one word for any path
 */
export function formatOf(
  table: Pick<Casting.Table, 'source' | 'path'>,
): string {
  const isAtAPath = table.path !== undefined

  return isAtAPath
    ? Words.PATH_FORMAT
    : tokenOf(table.source.replace(Tables.NO_HEADER, ''))
}
