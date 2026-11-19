import Limits from '../../limits'

/**
 * Seconds in one of each part of a compound duration, by its group.
 */
export const COMPOUND_SECONDS: Readonly<Record<string, number>> = {
  days: Limits.SECONDS_PER_DAY,
  hours: Limits.SECONDS_PER_HOUR,
  minutes: Limits.SECONDS_PER_MINUTE,
  seconds: 1,
}
