import type Casting from '../../../casting'
import Usage from '../../../usage'
import type Types from '../../types'

/**
 * Tells the format of a refusal only where exactly one table was found:
 * among several, none is the one that was meant.
 *
 * @param usage What is told of the asking so far.
 * @param table The first table found.
 * @param isOnlyTable Whether no other table was found.
 * @returns What is told, with that table's format where it is the only one.
 */
export const withFormatOf = (
  usage: Types.DrawnChart['usage'],
  table: Casting.Table,
  isOnlyTable: boolean,
): Types.DrawnChart['usage'] => ({
  ...usage,
  format: isOnlyTable ? Usage.formatOf(table) : usage.format,
})
