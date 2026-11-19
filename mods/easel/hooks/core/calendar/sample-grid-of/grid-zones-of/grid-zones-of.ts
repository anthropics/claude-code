import Limits from '../../limits'

/**
 * A step of a day or more may be even in the local calendar and not in UTC.
 *
 * @param gapMs the time from one sample to the next
 * @param localZone the IANA name of where the samples were written
 * @returns the calendars to try, in order
 */
export const gridZonesOf = (gapMs: number, localZone: string): string[] =>
  gapMs < Limits.DAY_MS ? ['UTC'] : ['UTC', localZone]
