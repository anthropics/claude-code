/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { RenderElement } from 'claude-code'

import Limits from '../../limits'
import PaneState from '../../pane-state'
import Detail from '../detail'
import Entries from '../entries'
import type { Kit } from '../kit'
import Layout from '../layout'
import { preludeOf } from '../prelude-of'
import Sections from '../sections'
import { dialogEntriesOf } from './dialog-entries-of'
import { dialogWindowOf } from './dialog-window-of'

/**
 * The inline pane (DiffDialog): its title, the dim count, then the file
 * list's window, or the picked file's detail alone, and the key hints.
 *
 * Every file lists in the built-in's order, five at a time round the
 * selected row (`❯ `, where the focus ring starts and what its walk moves,
 * ui.focus); Enter views that file, Escape backs out or closes.
 *
 * @param kit the elements, the handlers, the width
 * @param model the pane's state
 * @returns the pane's tree
 */
export function dialogPane(
  kit: Kit,
  model: PaneState.PaneModel,
): RenderElement {
  const { Box, Text } = kit.ui
  const prelude = preludeOf(kit, model)

  if (prelude) {
    return prelude
  }

  const turn = PaneState.pickedTurnOf(model)
  const { data } = model
  const entries = dialogEntriesOf(model)
  const totals = turn ? PaneState.turnTotalsOf(turn) : (data?.stats ?? null)
  const isTurn = model.source.kind === 'turn'
  const isPaged = entries.length > Limits.MAX_VISIBLE_FILES
  const picked = entries.find(entry => entry.path === model.selectedPath)
  const selected = picked ?? entries[0]
  const isDetail = model.dialogView === 'detail' && picked !== undefined

  const start = dialogWindowOf(
    model,
    entries.map(entry => entry.path),
  )

  const shown = entries.slice(start, start + Limits.MAX_VISIBLE_FILES)
  const blankEdge = Sections.dimNote(kit, ' ')
  const below = entries.length - start - shown.length

  const isTooMany =
    !isTurn &&
    data !== null &&
    data.stats.filesCount > 0 &&
    entries.length === 0

  const emptyWords = isTurn
    ? 'No file changes in this turn'
    : isTooMany
      ? 'Too many files to display details'
      : 'No changes yet'

  const message = entries.length > 0 ? null : emptyWords

  const subtitle = totals && (
    <Text dimColor wrap="truncate-end">
      {`${Layout.plural(totals.filesCount, 'file')} changed `}
      {Sections.diffStat(kit, totals.linesAdded, totals.linesRemoved)}
    </Text>
  )

  const noteOf = (entry: Entries.BodyEntry) =>
    entry.isUntracked ? 'untracked' : entry.isBinary ? 'Binary file' : null

  const rowOf = (entry: Entries.BodyEntry) =>
    Sections.dialogFileRow(
      kit,
      {
        key: Sections.fileKeyOf(entry),
        path: entry.path,
        displayPath: entry.displayPath,
        added: entry.added,
        removed: entry.removed,
        note: noteOf(entry),
        isSelected: entry === selected,
      },
      () => kit.actions.selectFile(entry.path),
    )

  function moreOf(way: 'up' | 'down', count: number): RenderElement {
    const arrow = way === 'up' ? '\u2191' : '\u2193'
    const words = Layout.plural(count, 'file').replace(' ', ' more ')

    return Sections.dimNote(kit, ` ${arrow} ${words}`)
  }

  const pagedEdgeOf = (way: 'up' | 'down', count: number) =>
    count > 0 ? moreOf(way, count) : blankEdge

  const edgeOf = (way: 'up' | 'down', count: number) =>
    isPaged ? pagedEdgeOf(way, count) : null

  const detailOf = (entry: Entries.BodyEntry): RenderElement[] => [
    Detail.detailView(
      kit,
      Entries.detailModelOf(entry, model),
      Detail.BODY_BUDGET,
    ).element,
  ]

  const rows = Sections.present([
    edgeOf('up', start),
    ...shown.map(rowOf),
    edgeOf('down', below),
  ])

  const listing = isDetail && picked ? detailOf(picked) : rows
  const body = message === null ? listing : [Sections.dimNote(kit, message)]

  const hint = isDetail
    ? '\u2191/\u2193 to scroll \u00b7 Esc to back'
    : '\u2191/\u2193 to select \u00b7 Enter to view \u00b7 Esc to close'

  return (
    <Box flexDirection="column">
      {Sections.present([
        Sections.titleRow(kit, PaneState.dialogTitleOf(model)),
        <Box height={1} />,
        subtitle,
        Sections.sourcePicker(kit, model),
        <Box flexDirection="column" marginTop={1} marginBottom={1}>
          {body}
        </Box>,
        Sections.dimNote(kit, hint),
      ])}
    </Box>
  )
}
