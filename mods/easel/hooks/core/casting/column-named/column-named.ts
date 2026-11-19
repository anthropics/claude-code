import type Types from '../types'

/**
 * `date` means `Date`. Beside a `DATE` it means neither.
 *
 * @param table the table whose header is searched
 * @param name a name as it was asked for, in any case
 * @returns the one header that it spells, else what was asked for
 */
export function columnNamed(table: Types.Table, name: string): string {
  const [match, ...otherMatches] = table.columns.filter(
    column => column.toLowerCase() === name.toLowerCase(),
  )

  return match !== undefined && otherMatches.length === 0 ? match : name
}
