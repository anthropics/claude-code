import Calendar from '../../../../../../calendar'

/**
 * Beside a series with weekends, one that keeps to weekdays lacks nothing.
 *
 * @param isSharedOnWeekdays whether all the series together skip weekends
 * @param ownTimes the sorted times of one series
 * @param zone the zone that days are told in
 * @returns whether the grid of that series skips weekends
 */
export const isKeptToWeekdays = (
  isSharedOnWeekdays: boolean,
  ownTimes: number[],
  zone: string,
): boolean => isSharedOnWeekdays || Calendar.isWeekdaysOnly(ownTimes, zone)
