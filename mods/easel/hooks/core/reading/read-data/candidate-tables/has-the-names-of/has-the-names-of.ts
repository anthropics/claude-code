import Casting from '../../../../casting'

/**
 * A table holds the names when each of them is one of its columns.
 *
 * @param names the columns that the call names
 * @returns what tells whether a table holds every one of them
 */
export const hasTheNamesOf =
  (names: string[]): ((table: Casting.Table) => boolean) =>
  table =>
    names.every(name =>
      table.columns.includes(Casting.columnNamed(table, name)),
    )
