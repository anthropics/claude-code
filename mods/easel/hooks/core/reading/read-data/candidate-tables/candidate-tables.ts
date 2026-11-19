import type CoreCall from '../../../call'
import type Casting from '../../../casting'
import { hasTheNamesOf } from './has-the-names-of'
import { isReadOverTime } from './is-read-over-time'
import { namesOf } from './names-of'

/**
 * If several hold every name, only those read over time stay: a name beside
 * a number, which makes bars, is too little to pick one by.
 *
 * @param tables every table that the result holds
 * @param request the chart that was asked for
 * @returns the tables that the call can mean
 */
export function candidateTables(
  tables: Casting.Table[],
  request: CoreCall.ChartRequest,
): Casting.Table[] {
  const isOnlyTable = tables.length === 1
  const candidates = isOnlyTable
    ? tables
    : tables.filter(hasTheNamesOf(namesOf(request)))
  const isOnlyCandidate = candidates.length === 1

  return isOnlyCandidate
    ? candidates
    : candidates.filter(table => isReadOverTime(table, request))
}
