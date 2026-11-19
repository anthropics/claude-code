import type Casting from '../../../../casting'

/**
 * Bars stand beside their names, so a made-up column name says nothing.
 *
 * @param table the table that was read
 * @param roles what each of its columns is read as
 * @returns the measured columns that the header may name
 */
export const measuresNamed = (
  table: Casting.Table,
  roles: Casting.Roles,
): string[] => (table.hasMadeUpNames && roles.form === 'bars' ? [] : roles.y)
