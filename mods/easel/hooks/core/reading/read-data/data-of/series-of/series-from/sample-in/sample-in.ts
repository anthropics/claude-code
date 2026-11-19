import type Types from '../../../../../types'

/**
 * A moment that no row gave a number for is a gap: its sample is null.
 *
 * @param readingsByTime the readings of one series, under their times
 * @param combine what makes one number of the rows that share a sample
 * @returns what reads the sample of that series at one moment
 */
export const sampleIn =
  (readingsByTime: Map<number, Types.CellReading[]>, combine: Types.Combiner) =>
  (ms: number): Types.Sample => {
    const values = (readingsByTime.get(ms) ?? [])
      .map(reading => reading.value)
      .filter(value => value !== null)

    return { ms, value: values.length > 0 ? combine(values) : null }
  }
