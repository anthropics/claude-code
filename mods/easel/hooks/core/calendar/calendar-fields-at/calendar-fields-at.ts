import Limits from '../limits'
import type Types from '../types'
import { formatterOf } from './formatter-of'

/**
 * What the wall clock shows at an instant, from year to millisecond.
 *
 * The Swedish locale writes `2026-09-14 13:05:09`. One `format` and a split
 * are several times quicker than `formatToParts`.
 *
 * @param ms the instant
 * @param zone the IANA name of where the clock hangs
 * @returns the seven fields the clock shows
 */
export function calendarFieldsAt(
  ms: number,
  zone: string,
): Types.CalendarFields {
  const millisecond = ms - Math.floor(ms / Limits.SECOND_MS) * Limits.SECOND_MS

  if (zone === 'UTC') {
    const date = new Date(ms)

    return [
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      millisecond,
    ]
  }

  const [year = 0, month = 1, day = 1, hour = 0, minute = 0, second = 0] =
    formatterOf(zone)
      .format(ms)
      .split(/[- :]/, Limits.FORMATTED_FIELD_COUNT)
      .map(Number)

  return [year, month - 1, day, hour, minute, second, millisecond]
}
