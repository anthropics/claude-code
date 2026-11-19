import type Reading from '../../reading'
import type Types from '../types'

/**
 * Measured once, for the selection and the scales.
 *
 * @param series the series as it was read
 * @returns the same series with its values and its size
 */
export function sizedSeriesOf(series: Reading.Series): Types.SizedSeries {
  const values = series.samples
    .map(sample => sample.value)
    .filter(value => value !== null)

  return {
    ...series,
    values,
    size: Math.max(...values.map(Math.abs)),
    isOthers: false,
  }
}
