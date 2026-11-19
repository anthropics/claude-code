import { hasUnreadDates } from '../../../has-unread-dates'
import type Types from '../../../types'

/**
 * Names on the x axis are drawn as bars where no form was asked for. Text
 * that looks like dates is no name.
 *
 * @param columns the classified columns, none where a format gave the roles
 * @param xName the header of the x axis
 * @returns whether the x axis is a column of names
 */
export function hasNamesAsX(columns: Types.Column[], xName: string): boolean {
  const xColumn = columns.find(column => column.name === xName)

  return xColumn?.soleKind === 'text' && !hasUnreadDates(xColumn)
}
