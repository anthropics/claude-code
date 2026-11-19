import type Reading from '../../../reading'
import Limits from '../../limits'
import { summedSeries } from '../../summed-series'
import type Types from '../../types'

/**
 * Counted as a part, a total halves every share and doubles every stack. It may
 * still be a part, so it is drawn, and the note says what to do.
 *
 * @param allSeries every series that was read
 * @param plural what the parts are called in the note
 * @returns a note for each series that equals the sum of the others
 */
export function likelyTotalNotes(
  allSeries: Types.SizedSeries[],
  plural: string,
): string[] {
  if (allSeries.length <= Limits.MIN_PARTS_BESIDE_A_TOTAL) {
    return []
  }

  const sumAt = new Map(
    summedSeries(allSeries, '').samples.map(({ ms, value }) => [ms, value]),
  )
  const isHalfOfTheSum = ({
    ms,
    value,
  }: Reading.Series['samples'][number]): boolean =>
    value !== null &&
    Math.abs(
      Limits.TIMES_A_TOTAL_IS_IN_THE_SUM * value - (sumAt.get(ms) ?? 0),
    ) <=
      Limits.SUM_TOLERANCE * Math.abs(value)

  return allSeries
    .filter(series => series.size > 0 && series.samples.every(isHalfOfTheSum))
    .map(
      series =>
        `${series.name} equals the sum of the other ${plural}: ` +
        `if it is their total, leave it out`,
    )
}
