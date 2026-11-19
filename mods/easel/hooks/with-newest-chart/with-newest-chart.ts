import type { EngineInterface, RenderElement } from 'claude-code'

import CoreCall from '../core/call'
import type Shell from '../shell'
import { finishedCallsOf } from '../shell/finished-calls-of'
import { isReaderOn } from '../shell/is-reader-on'
import Limits from '../shell/limits'
import { outcomeOfRow } from '../shell/outcome-of-row'
import { rowAsCalled } from '../shell/row-as-called'
import View from '../view'

/**
 * The calls come oldest first, and none older than the newest chart is read
 * for one.
 * Where the host drew nothing (null), the chart is shown alone.
 *
 * @param $ the host's interface
 * @param drawing what the host drew, for which calls, and where it asks
 * @returns the host's drawing with the newest chart below it, or as it was
 */
export async function withNewestChart<HostRow extends RenderElement | null>(
  $: EngineInterface,
  drawing: Shell.HostDrawing<HostRow>,
): Promise<RenderElement | HostRow> {
  const { cache, event } = drawing
  const columns = event.viewport?.columns
  const readTranscript = async (): Promise<Shell.FinishedCall[]> =>
    finishedCallsOf(await $.session.messages({}))
  const called = await Promise.all(
    drawing.rows.map(row => rowAsCalled(readTranscript, cache, row)),
  )
  const rows = called.filter(row => drawing.isCharted(row.tool))

  for (const row of rows.toReversed()) {
    const outcome = await outcomeOfRow(readTranscript, cache, {
      row,
      hasWholeOutput: event.surface === 'terminal',
    })

    if (outcome.kind !== 'chart') {
      continue
    }

    if (event.surface !== 'terminal') {
      const image = View.imageChart({
        elements: $.ui.resolve(event),
        chart: outcome,
        columns,
        callCount: rows.length,
      })

      return View.belowRow($.ui.resolve(event), drawing, image)
    }

    if (cache.screenReader === 'unread') {
      const variable = await $.env.get('CLAUDE_AX_SCREEN_READER')
      // Only managed, --settings and user settings: a repository's settings
      // could otherwise turn the mode on for anyone who opens it.
      const tiers: Shell.SettingsRead[] = []
      for (const source of ['policy', 'flag', 'user'] as const) {
        tiers.push(await $.settings.read({ source }))
      }
      cache.screenReader = isReaderOn(variable, tiers) ? 'on' : 'off'
    }

    const isAsked = row.tool === CoreCall.TOOL_NAME
    const chart = View.terminalChart({
      elements: $.ui.resolve(event),
      chart: outcome,
      columns: columns ?? Limits.DEFAULT_COLUMNS,
      isScreenReader: cache.screenReader === 'on',
      autoCallCount: isAsked ? undefined : rows.length,
    })

    return View.belowRow($.ui.resolve(event), drawing, chart)
  }

  return drawing.hostRow
}
