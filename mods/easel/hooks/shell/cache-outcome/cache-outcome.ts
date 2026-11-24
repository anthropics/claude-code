import type Easel from '../../core/easel'
import Limits from '../limits'
import type Types from '../types'

/**
 * Keeps what a finished call draws, so that it is worked out once.
 *
 * When the store is full, the newest chart makes room. The host asks for rows
 * in order, so dropping the oldest would drop each row just before its turn.
 *
 * @param cache where the charts of the session are kept
 * @param id the id of the call
 * @param kept what the call draws, and for which words of its row
 * @returns what the call draws
 */
export function cacheOutcome(
  cache: Types.ChartCache,
  id: string,
  kept: Types.KeptChart,
): Easel.Outcome {
  const { outcome } = kept

  if (outcome.kind === 'none') {
    cache.chartlessIds.add(id)

    return outcome
  }

  const newestId = [...cache.charts.keys()].at(-1)
  const isFull =
    cache.charts.size >= Limits.MAX_CACHED_CHARTS &&
    newestId !== undefined &&
    !cache.charts.has(id)

  if (isFull) {
    cache.charts.delete(newestId)
  }

  cache.charts.set(id, kept)

  return outcome
}
