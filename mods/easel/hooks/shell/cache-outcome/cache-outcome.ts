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
 * @param outcome what the call draws
 * @returns what was passed to keep, as it is
 */
export function cacheOutcome(
  cache: Types.ChartCache,
  id: string,
  outcome: Easel.Outcome,
): Easel.Outcome {
  if (outcome.kind === 'none') {
    cache.chartlessIds.add(id)

    return outcome
  }

  const newestId = [...cache.charts.keys()].at(-1)
  const isFull =
    cache.charts.size >= Limits.MAX_CACHED_CHARTS && newestId !== undefined

  if (isFull) {
    cache.charts.delete(newestId)
  }

  cache.charts.set(id, outcome)

  return outcome
}
