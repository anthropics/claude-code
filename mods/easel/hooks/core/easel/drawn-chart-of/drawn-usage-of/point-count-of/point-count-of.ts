import Lists from '../../../../lists'
import type Reading from '../../../../reading'

/**
 * Counts the samples that hold a value, over every series.
 *
 * @param data The rows as they were read.
 * @returns How many points the chart can show.
 */
export const pointCountOf = (data: Reading.Data): number =>
  Lists.sumOf(
    data.series
      .flatMap(series => series.samples)
      .map(sample => (sample.value === null ? 0 : 1)),
  )
