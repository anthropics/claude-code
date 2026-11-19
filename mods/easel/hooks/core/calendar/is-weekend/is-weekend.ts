import { calendarFieldsAt } from '../calendar-fields-at'
import Limits from '../limits'
import { wallClockMs } from '../wall-clock-ms'

/**
 * True on a Saturday or a Sunday of the wall clock.
 *
 * @param ms the instant
 * @param zone the IANA name of where the clock hangs
 * @returns whether the day is one of the two
 */
export function isWeekend(ms: number, zone: string): boolean {
  const weekday = new Date(wallClockMs(calendarFieldsAt(ms, zone))).getUTCDay()

  return weekday === 0 || weekday === Limits.SATURDAY
}
