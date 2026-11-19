import { summedSeries } from '../../../summed-series'
import type Types from '../../../types'

/**
 * Sums the series that were cut into the one drawn after the largest.
 *
 * @param cutSeries the series that are not drawn on their own
 * @returns their sum, named for how many they are
 */
export const othersOf = (
  cutSeries: Types.SizedSeries[],
): Types.SizedSeries => ({
  ...summedSeries(cutSeries, `${cutSeries.length} others`),
  isOthers: true,
})
