import { columnNamed } from '../../column-named'
import type Types from '../../types'

/**
 * Binds the header that names are looked up in, so that a list of names
 * that were asked for maps to the columns they spell.
 *
 * @param table the table whose header is searched
 * @returns a function from a name as asked to the header it spells
 */
export const columnNamedIn =
  (table: Types.Table): ((name: string) => string) =>
  name =>
    columnNamed(table, name)
