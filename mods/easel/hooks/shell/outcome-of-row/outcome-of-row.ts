import CoreCall from '../../core/call'
import Easel from '../../core/easel'
import { cacheOutcome } from '../cache-outcome'
import { queryOf } from '../query-of'
import { storedTextOf } from '../stored-text-of'
import type Types from '../types'
import { autoChartOf } from './auto-chart-of'
import { autoChartOnApp } from './auto-chart-on-app'
import { clockOfCall } from './clock-of-call'
import { isEveryNameTold } from './is-every-name-told'
import { isReadAnswered } from './is-read-answered'
import { isRowAsKept } from './is-row-as-kept'
import { isToldAsDrawn } from './is-told-as-drawn'
import { NO_CHART } from './no-chart'
import { sharedTranscript } from './shared-transcript'

/**
 * A terminal gets the whole result with the call. An app gets a shortened
 * copy, so there the stored result is looked up by id. A kept chart serves only
 * a row with the words that it was drawn for, since a hook can change them.
 *
 * A chart call always needs the transcript, for its input and for the results
 * before it. A call that the first read lacks is newer than it, so a second
 * one is due.
 *
 * @param readTranscript reads the main transcript afresh from the host
 * @param cache where the charts and the read of the transcript are kept
 * @param drawn the call as the host draws it, and whether its result is whole
 * @returns what the call draws, a chart or none
 */
export async function outcomeOfRow(
  readTranscript: Types.TranscriptRead,
  cache: Types.ChartCache,
  drawn: Types.DrawnRow,
): Promise<Easel.Outcome> {
  const { tool_use_id, tool, input, output, isErrored } = drawn.row

  const isUnreadable =
    isErrored || output === undefined || tool_use_id === undefined

  if (isUnreadable) {
    return NO_CHART
  }

  const isAutoChart = tool !== CoreCall.TOOL_NAME
  const words = {
    text: storedTextOf(output),
    query: isAutoChart ? queryOf(input) : '',
  }
  const cached = cache.charts.get(tool_use_id)

  if (cached?.text === words.text && cached.query === words.query) {
    return cached.outcome
  }

  if (cache.chartlessIds.has(tool_use_id)) {
    return NO_CHART
  }

  const keep = (outcome: Easel.Outcome): Easel.Outcome =>
    cacheOutcome(cache, tool_use_id, { ...words, outcome })
  const isReadFromRow = isAutoChart && drawn.hasWholeOutput

  if (isReadFromRow) {
    return keep(autoChartOf(cache, { id: tool_use_id, ...words }))
  }

  const firstRead = sharedTranscript(readTranscript, cache)
  const isInFirstRead = (await firstRead).some(call => call.id === tool_use_id)
  const calls = await (isInFirstRead
    ? firstRead
    : sharedTranscript(readTranscript, cache, firstRead))
  const callIndex = calls.findIndex(call => call.id === tool_use_id)
  const call = calls[callIndex]

  if (!call) {
    const isSettled = isReadAnswered(calls) && cached === undefined

    return isSettled ? keep(NO_CHART) : NO_CHART
  }

  if (isAutoChart) {
    const outcome = autoChartOnApp(cache, drawn, call)
    const isSettled = outcome.kind === 'chart' || isRowAsKept(drawn, call)

    return isSettled ? keep(outcome) : outcome
  }

  if (!isToldAsDrawn(drawn, call)) {
    return NO_CHART
  }

  const outcome =
    cached?.outcome ??
    Easel.chartFromCall({
      input: call.input,
      results: calls.slice(0, callIndex),
      ...clockOfCall(call.storedResult),
    })
  const told = storedTextOf(call.storedResult, call.readText)
  const isUntold =
    outcome.kind === 'chart' &&
    !(cache.calledTools.has(tool_use_id)
      ? told.includes(outcome.modelText)
      : isEveryNameTold(outcome.modelText, told))

  return keep(isUntold ? NO_CHART : outcome)
}
