import Lists from '../../../lists'
import type Types from '../../types'

/**
 * A time holds the sum of what the series have there, and a gap where none
 * of them has a value.
 *
 * @param seriesToAdd the series to sum
 * @returns a sample for each time any of them has, the earliest first
 */
export const summedSamplesOf = (
  seriesToAdd: Types.SizedSeries[],
): Types.SizedSeries['samples'] =>
  [
    ...Lists.groupBy(
      seriesToAdd.flatMap(series => series.samples),
      sample => sample.ms,
    ),
  ]
    .toSorted(([firstMs], [secondMs]) => firstMs - secondMs)
    .map(([ms, samplesAtMs]) => {
      const values = samplesAtMs
        .map(sample => sample.value)
        .filter(value => value !== null)

      return { ms, value: values.length > 0 ? Lists.sumOf(values) : null }
    })
