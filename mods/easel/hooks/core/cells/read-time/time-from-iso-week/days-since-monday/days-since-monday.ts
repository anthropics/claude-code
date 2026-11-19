import Limits from '../../../limits'

/**
 * Counts the days from the Monday before to the day of an instant.
 *
 * `getUTCDay` counts from Sunday, and an ISO week starts on Monday.
 *
 * @param ms the instant, in ms since the epoch
 * @returns 0 for a Monday, up to 6 for a Sunday
 */
export const daysSinceMonday = (ms: number): number =>
  (new Date(ms).getUTCDay() + Limits.DAYS_PER_WEEK - 1) % Limits.DAYS_PER_WEEK
