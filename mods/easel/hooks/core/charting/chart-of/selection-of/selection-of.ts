import type Types from '../../types'
import { orderByName } from './order-by-name'
import { othersOf } from './others-of'

/**
 * A tie goes by name, so that the order of the input rows cannot change which
 * key a series gets. A rest of a single series is drawn on its own.
 *
 * @param allSeries every series that was read
 * @param count how many are drawn on their own
 * @param isWhole whether the rest is drawn as one more
 * @returns the largest series, the cut ones, and all that are drawn
 */
export function selectionOf(
  allSeries: Types.SizedSeries[],
  count: number,
  isWhole: boolean,
): Record<'topSeries' | 'cutSeries' | 'drawnSeries', Types.SizedSeries[]> {
  const topSeries = allSeries
    .toSorted((first, second) => {
      const isOneLarger = first.size !== second.size

      return isOneLarger ? second.size - first.size : orderByName(first, second)
    })
    .slice(0, isWhole && allSeries.length === count + 1 ? count + 1 : count)
  const cutSeries = allSeries.filter(series => !topSeries.includes(series))
  const isRestDrawnAsOneMore = isWhole && cutSeries.length > 0

  return {
    topSeries,
    cutSeries,
    drawnSeries: isRestDrawnAsOneMore
      ? [...topSeries, othersOf(cutSeries)]
      : topSeries,
  }
}
