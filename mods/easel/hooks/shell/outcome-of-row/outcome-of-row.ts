import CoreCall from '../../core/call'
import Easel from '../../core/easel'
import { cacheOutcome } from '../cache-outcome'
import { storedTextOf } from '../stored-text-of'
import type Types from '../types'
import { autoChartOf } from './auto-chart-of'
import { clockOfCall } from './clock-of-call'
import { isReadAnswered } from './is-read-answered'
import { NO_CHART } from './no-chart'
import { sharedTranscript } from './shared-transcript'

/**
 * A terminal gets the whole result with the call. An app gets a shortened
 * copy, so there the stored result is looked up by id.
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

  const isChartless = cache.chartlessIds.has(tool_use_id)
  const cached = isChartless ? NO_CHART : cache.charts.get(tool_use_id)

  if (cached) {
    return cached
  }

  const isAutoChart = tool !== CoreCall.TOOL_NAME
  const isReadFromRow = isAutoChart && drawn.hasWholeOutput

  if (isReadFromRow) {
    return cacheOutcome(
      cache,
      tool_use_id,
      autoChartOf(cache, {
        id: tool_use_id,
        input,
        text: storedTextOf(output),
      }),
    )
  }

  const firstRead = sharedTranscript(readTranscript, cache)
  const isInFirstRead = (await firstRead).some(call => call.id === tool_use_id)
  const calls = await (isInFirstRead
    ? firstRead
    : sharedTranscript(readTranscript, cache, firstRead))
  const callIndex = calls.findIndex(call => call.id === tool_use_id)
  const call = calls[callIndex]

  if (!call) {
    const isAnswered = isReadAnswered(calls)

    return isAnswered ? cacheOutcome(cache, tool_use_id, NO_CHART) : NO_CHART
  }

  return cacheOutcome(
    cache,
    tool_use_id,
    isAutoChart
      ? autoChartOf(cache, {
          id: tool_use_id,
          input: call.input,
          text: storedTextOf(call.storedResult),
        })
      : Easel.chartFromCall({
          input: call.input,
          results: calls.slice(0, callIndex),
          ...clockOfCall(call.storedResult),
        }),
  )
}
