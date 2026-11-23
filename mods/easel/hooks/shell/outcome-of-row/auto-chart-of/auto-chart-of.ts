import Easel from '../../../core/easel'
import { queryOf } from '../../query-of'
import type Types from '../../types'

/**
 * A row draws what it holds, which a later hook may have changed. The call
 * that answered last takes its chart out of the cache, to use it where the
 * text is still the same.
 *
 * @param cache where the charts of the session are kept
 * @param call the call and its result as the conversation holds it
 * @returns the chart drawn, or none
 */
export function autoChartOf(
  cache: Types.ChartCache,
  call: Types.ShownResult,
): Easel.Outcome {
  const newest = cache.newestAutoChart
  const isNewest = newest?.id === call.id

  if (isNewest) {
    cache.newestAutoChart = undefined
  }

  return isNewest && newest.text === call.text
    ? newest.chart
    : Easel.chartFromResult(
        call.text,
        cache.autoChartCalls.get(call.id) ?? {
          nowMs: null,
          query: queryOf(call.input),
        },
      )
}
