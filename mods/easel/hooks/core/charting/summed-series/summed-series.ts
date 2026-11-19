import { sizedSeriesOf } from '../sized-series-of'
import type Types from '../types'
import { unitOf } from '../unit-of'
import { summedSamplesOf } from './summed-samples-of'

/**
 * The sum has the unit and the measure of the first, and a sample wherever
 * any series has.
 *
 * @param seriesToAdd the series to sum
 * @param name what the sum is called
 * @returns the sum as one series
 */
export const summedSeries = (
  seriesToAdd: Types.SizedSeries[],
  name: string,
): Types.SizedSeries =>
  sizedSeriesOf({
    unit: unitOf(seriesToAdd),
    name,
    measure: seriesToAdd[0]?.measure ?? '',
    samples: summedSamplesOf(seriesToAdd),
  })
