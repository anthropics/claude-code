import type Types from '../types'

/**
 * A bar is a series of a single sample.
 *
 * @param barSeries the series of one bar
 * @returns its value, or 0 where it has none
 */
export const barValueOf = (barSeries: Types.SizedSeries): number =>
  barSeries.values[0] ?? 0
