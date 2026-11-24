import type Easel from '../../../core/easel'
import { queryOf } from '../../query-of'
import { storedTextOf } from '../../stored-text-of'
import type Types from '../../types'
import { autoChartOf } from '../auto-chart-of'
import { isRowAsKept } from '../is-row-as-kept'
import { NO_CHART } from '../no-chart'

/**
 * The transcript has the result whole, but a row that a hook rewrote is read
 * as it is shown. A page's own copy of the conversation can say a result in
 * other words, so there the transcript stands in where the row gives no chart.
 *
 * @param cache where the charts of the session are kept
 * @param drawn the call as the app draws it
 * @param call the same call as the transcript holds it
 * @returns the chart drawn, or none
 */
export function autoChartOnApp(
  cache: Types.ChartCache,
  drawn: Types.DrawnRow,
  call: Types.FinishedCall,
): Easel.Outcome {
  const { row, isOfAnotherCopy } = drawn

  if (storedTextOf(call.storedResult) === '') {
    return NO_CHART
  }

  const query =
    queryOf(row.input) || (isOfAnotherCopy ? queryOf(call.input) : '')
  const chartOf = (text: string): Easel.Outcome =>
    autoChartOf(cache, { id: call.id, query, text })

  if (isRowAsKept(drawn, call)) {
    return chartOf(call.text)
  }

  const asShown = chartOf(storedTextOf(row.output))
  const isUnsure = isOfAnotherCopy && asShown.kind !== 'chart'

  return isUnsure ? chartOf(call.text) : asShown
}
