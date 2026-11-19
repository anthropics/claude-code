import { calendarFieldsAt } from '../../../calendar-fields-at'
import type Types from '../../../types'
import { wallClockMs } from '../../../wall-clock-ms'

/**
 * In milliseconds, below zero west of Greenwich.
 *
 * @param ms the instant
 * @param walk what is stepped over, for where its clock hangs
 * @returns how far the wall clock is ahead of UTC
 */
export const utcOffsetAt = (ms: number, walk: Types.Walk): number =>
  walk.zone === 'UTC' ? 0 : wallClockMs(calendarFieldsAt(ms, walk.zone)) - ms
