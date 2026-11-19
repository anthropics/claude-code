import { isWeekend } from '../is-weekend'
import Limits from '../limits'
import { weekOf } from './week-of'

/**
 * True where samples span enough weeks and none falls on a weekend.
 *
 * @param sortedMs the instants of the samples, rising
 * @param zone the IANA name of where the weekdays are read
 * @returns whether weekends are left out on purpose
 */
export const isWeekdaysOnly = (sortedMs: number[], zone: string): boolean =>
  weekOf(sortedMs.at(-1) ?? 0, zone) - weekOf(sortedMs[0] ?? 0, zone) >=
    Limits.MIN_WEEKENDS_SKIPPED && !sortedMs.some(ms => isWeekend(ms, zone))
