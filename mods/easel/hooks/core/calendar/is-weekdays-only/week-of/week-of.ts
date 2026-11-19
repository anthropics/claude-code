import { calendarFieldsAt } from '../../calendar-fields-at'
import Limits from '../../limits'
import { wallClockMs } from '../../wall-clock-ms'

/**
 * Counts weeks that begin on a Monday, so that a weekend falls inside one.
 *
 * @param ms the instant
 * @param zone the IANA name of where the clock hangs
 * @returns the number of the week
 */
export const weekOf = (ms: number, zone: string): number =>
  Math.floor(
    (wallClockMs(calendarFieldsAt(ms, zone)) / Limits.DAY_MS +
      Limits.DAYS_FROM_MONDAY_TO_1970) /
      Limits.DAYS_IN_WEEK,
  )
