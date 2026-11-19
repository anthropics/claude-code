import Numbers from '../../../numbers'
import type Reading from '../../../reading'
import { peakTimeOf } from '../../peak-time-of'
import { summedSeries } from '../../summed-series'
import type Types from '../../types'

/**
 * Tells where the sum of all the series is highest.
 *
 * @param allSeries every series, drawn or not
 * @param timeline when the samples run
 * @returns the fact for the header
 */
export function peakOfTotalFact(
  allSeries: Types.SizedSeries[],
  timeline: Reading.Timeline,
): string {
  const total = summedSeries(allSeries, 'total')
  const [peak = ''] = Numbers.formatValues(total.unit, [
    Math.max(...total.values),
  ])

  return `total max ${peak} at ${peakTimeOf(total, timeline)}`
}
