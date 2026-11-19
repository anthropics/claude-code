import type Types from '../../../types'

/**
 * Roles hold names only: this picks the name out of an entry.
 *
 * @param column the column that got a role
 * @returns the name of its header
 */
export const nameOf = (column: Types.Column): string => column.name
