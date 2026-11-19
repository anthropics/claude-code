import type CoreCall from '../../../../call'
import Casting from '../../../../casting'

/**
 * A table is read over time when its columns take their roles and the form
 * they make is not bars.
 *
 * @param table one table that holds every name
 * @param request the chart that was asked for
 * @returns whether the call reads the table over time
 */
export function isReadOverTime(
  table: Casting.Table,
  request: CoreCall.ChartRequest,
): boolean {
  const roles = Casting.rolesOf(table, request)

  return !('code' in roles) && roles.form !== 'bars'
}
