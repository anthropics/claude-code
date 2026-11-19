import type Types from '../../types'

/**
 * Puts the roles together once every one is settled.
 *
 * @param form what the columns are read as
 * @param x the header of the x axis
 * @param others the headers of the values, and of what splits the rows
 * @returns the roles of the table's columns
 */
export const formedRoles = (
  form: Types.Roles['form'],
  x: string,
  others: Pick<Types.Roles, 'y' | 'by'>,
): Types.Roles => ({ form, x, ...others })
