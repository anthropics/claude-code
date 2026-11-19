import Limits from '../../limits'
import type Types from '../../types'
import { wallClockMs } from '../../wall-clock-ms'
import { utcOffsetAt } from './utc-offset-at'

/**
 * Turns what a wall clock shows into the instant that shows it.
 *
 * The first guess takes the offset of the day before, so that a time shown
 * twice gives its first. A skipped time fits neither offset, and the later
 * try is past the skip.
 *
 * @param fields the year, then as many finer fields as are known
 * @param walk what is stepped over, for where its clock hangs
 * @returns the instant, or NaN where `Date` cannot hold it
 */
export function instantOf(fields: readonly number[], walk: Types.Walk): number {
  const wallMs = wallClockMs(fields)
  const guessMs = wallMs - utcOffsetAt(wallMs - Limits.DAY_MS, walk)
  const foundMs = wallMs - utcOffsetAt(guessMs, walk)
  const isShown = foundMs + utcOffsetAt(foundMs, walk) === wallMs

  return isShown ? foundMs : Math.max(guessMs, foundMs)
}
