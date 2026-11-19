import type Types from '../../types'

/**
 * A span of time that includes both of its ends.
 *
 * @param fromMs the first instant
 * @param untilMs the last instant
 * @param zone the IANA name of where the calendar is read
 * @returns the span
 */
export const spanBetween = (
  fromMs: number,
  untilMs: number,
  zone: string,
): Types.TimeSpan => ({ fromMs, untilMs, zone })
