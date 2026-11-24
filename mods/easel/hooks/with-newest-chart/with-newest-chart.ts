import type { EngineInterface, RenderElement } from 'claude-code'

import CoreCall from '../core/call'
import type Shell from '../shell'
import { finishedCallsOf } from '../shell/finished-calls-of'
import { isReaderOn } from '../shell/is-reader-on'
import Limits from '../shell/limits'
import { outcomeOfRow } from '../shell/outcome-of-row'
import Patterns from '../shell/patterns'
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
  const isTerminal = event.surface === 'terminal'
  // A terminal and VS Code cut nothing that is short enough to chart, and give
  // no label: there both are a hook's doing.
  const mayBeCut = !isTerminal && event.surface !== 'vscode'
  const called = await Promise.all(
    drawing.rows.map(async row => ({
      row: await rowAsCalled(readTranscript, cache, row),
      hasWholeOutput: isTerminal,
      mayBeCut,
      isOfAnotherCopy: mayBeCut && Patterns.ROW_LABEL.test(row.tool),
    })),
  )
  const rows = called.filter(({ row }) => drawing.isCharted(row.tool))

  for (const drawn of rows.toReversed()) {
    const outcome = await outcomeOfRow(readTranscript, cache, drawn)

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

    const isAsked = drawn.row.tool === CoreCall.TOOL_NAME
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
