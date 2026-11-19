import type Types from '../../types'
import { hasNamesAsX } from './has-names-as-x'

/**
 * The form drawn where none was asked for and no format gave one: bars over
 * names, a line over anything else.
 *
 * @param columns the classified columns, none where a format gave the roles
 * @param xName the header of the x axis
 * @returns `bars` where the x axis is a column of names, else `line`
 */
export const usualFormOf = (
  columns: Types.Column[],
  xName: string,
): Types.Roles['form'] => (hasNamesAsX(columns, xName) ? 'bars' : 'line')
