import Easel from '../../../core/easel'
import type Types from '../../types'

/**
 * A row draws what it holds, which a later hook may have changed. The call
 * that answered last takes its chart out of the cache, to use it where the
 * words are still the same.
 *
 * @param cache where the charts of the session are kept
 * @param call the call and its result as they are to be charted
 * @returns the chart drawn, or none
 */
export function autoChartOf(
  cache: Types.ChartCache,
  call: Types.ShownResult,
): Easel.Outcome {
  const newest = cache.newestAutoChart
  const isNewest = newest?.id === call.id
  const made = cache.autoChartCalls.get(call.id)

  if (isNewest) {
    cache.newestAutoChart = undefined
  }

  return isNewest && newest.text === call.text && made?.query === call.query
    ? newest.chart
    : Easel.chartFromResult(call.text, {
        nowMs: made?.nowMs ?? null,
        query: call.query,
      })
}
