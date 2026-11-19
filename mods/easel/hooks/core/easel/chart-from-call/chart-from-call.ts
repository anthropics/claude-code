import CoreCall from '../../call'
import ColumnSummary from '../../column-summary'
import Reading from '../../reading'
import Texts from '../../texts'
import Usage from '../../usage'
import { drawnChartOf } from '../drawn-chart-of'
import { refuse } from '../refuse'
import type Types from '../types'
import { asBars } from './as-bars'
import { askedUsageOf } from './asked-usage-of'
import { barsInPlaceOf } from './bars-in-place-of'
import { drawnAsBars } from './drawn-as-bars'
import { noDataRefusal } from './no-data-refusal'
import { noTextProblem } from './no-text-problem'
import { tableTextOf } from './table-text-of'
import { withFormatOf } from './with-format-of'
import { withNamesListed } from './with-names-listed'
import { withShareSummed } from './with-share-summed'

/**
 * One of the core's two entry points: a chart the model asks for. The tool's
 * own answers are never data, and one asking always has one answer.
 *
 * Both entry points run one pipeline: readData, chartOf, sceneOf, then one of
 * two painters. Every refusal is laid out here. Its reason is worded where it
 * is found.
 *
 * @param call The tool's input, the other tools' answers, and the clock.
 * @returns The chart drawn, or the refusal the model reads.
 */
export function chartFromCall(
  call: Types.ChartCall,
): Types.DrawnChart | Types.RefusedChart {
  const cleanInput = withNamesListed(Texts.cleanDeep(call.input ?? {}))
  const isRequest = CoreCall.isChartRequest(cleanInput)

  if (!isRequest) {
    return refuse(
      'bad_call',
      CoreCall.schemaErrors(cleanInput),
      Usage.NOTHING_DRAWN,
    )
  }

  const request: CoreCall.ChartRequest = withShareSummed(cleanInput)
  const { data } = request
  const candidates = call.results.filter(
    result => result.tool !== CoreCall.TOOL_NAME,
  )
  const isLatestMeant = data === undefined
  const chosen = isLatestMeant
    ? candidates.findLast(result => result.text.trim() !== '')
    : candidates.find(result => result.id === data)
  const otherResults = candidates.filter(result => result !== chosen)
  const tableText = tableTextOf(call.input)
  const rows = typeof data === 'object' ? JSON.stringify(data) : undefined
  const text = rows ?? chosen?.text ?? tableText
  const resultFrom = isLatestMeant ? 'last_result' : 'result_id'
  const textFrom = tableText === undefined ? 'none' : 'text'
  const foundFrom = chosen ? resultFrom : textFrom
  const usage = askedUsageOf(request, rows ? 'rows' : foundFrom)

  if (text === undefined) {
    return noDataRefusal(noTextProblem(isLatestMeant), otherResults, usage)
  }

  const clock = {
    zone: request.zone === 'local' ? call.zone : 'UTC',
    nowMs: call.nowMs,
  }
  const read = Reading.readData(text, request, clock)
  const isData = read.kind === 'data'

  if (isData) {
    return drawnChartOf(read, request, usage)
  }

  const bars = read.problem.fitsBars
    ? barsInPlaceOf(
        read,
        Reading.readData(text, asBars(request), clock),
        request,
      )
    : read
  const areBarsRead = bars.kind === 'data'

  if (areBarsRead) {
    return drawnAsBars(bars, request, usage)
  }

  const [table, ...otherTables] = bars.tables
  const hasTable = table !== undefined

  return hasTable
    ? refuse(
        bars.problem.code,
        [bars.problem.why, ...ColumnSummary.columnSummaryOf(bars.tables)],
        withFormatOf(usage, table, otherTables.length === 0),
      )
    : noDataRefusal(bars.problem, otherResults, usage)
}
