import Calendar from '../../../calendar'
import type Types from '../../types'
import { unread } from '../../unread'
import { isDifferentIn } from './is-different-in'
import { timeOfWallClock } from './time-of-wall-clock'

/**
 * Turns the groups of a matched date into its instant, in ms since the epoch.
 *
 * `Date` rolls Feb 30 over to Mar 2, so the fields must read back the same.
 *
 * @param parts the named groups of the match
 * @returns the instant, or that there is no such date
 */
export function timeFromParts(parts: Types.MatchGroups): Types.TimeRead {
  const { year, month = '1', day = '1', monthName } = parts
  const { hour = '0', minute = '0', second = '0' } = parts
  const isNumberedMonth = monthName === undefined
  const fields = [
    year,
    isNumberedMonth
      ? Number(month) - 1
      : Calendar.MONTHS.findIndex(name => monthName.startsWith(name)),
    day,
    hour,
    minute,
    second,
  ].map(Number)
  const wallMs = Calendar.wallClockMs(fields)
  const isRolledOver = fields.some(
    isDifferentIn(Calendar.calendarFieldsAt(wallMs, 'UTC')),
  )

  return isRolledOver ? unread('no such date') : timeOfWallClock(wallMs, parts)
}
