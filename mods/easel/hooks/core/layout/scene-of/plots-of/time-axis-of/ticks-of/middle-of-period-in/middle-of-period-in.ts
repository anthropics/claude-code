import type Reading from '../../../../../../reading'
import Limits from '../../../../../limits'

/**
 * Places a time at the middle of its period, as a share of all the periods.
 *
 * A period is found by its start: the first at the time or later.
 *
 * @param timeline the time on the axis, with the starts of its periods
 * @returns the position of a time among the periods
 */
export const middleOfPeriodIn =
  (timeline: Reading.Timeline) =>
  (ms: number): number =>
    (timeline.periodStarts.findIndex(start => start >= ms) +
      Limits.MIDDLE_OF_PERIOD) /
    timeline.periodStarts.length
