import { countOf } from '../../../../count-of'
import Git from '../../../../git'
import { keptOf } from '../../../../kept-of'
import Limits from '../../../../limits'
import type PaneState from '../../../../pane-state'
import Detail from '../../../detail'
import Entries from '../../../entries'
import Layout from '../../../layout'
import type { DockPlan, Segment } from '../../types'

/**
 * The docked pane's scrolling body as segments (ReplDiffSidebar's scroll
 * box): each listed file's block, a blank between, the pre-session section.
 *
 * Under an empty state whose pre-session section is open, the empty lines
 * head the body instead. Hunks are made printable and split under a leaf's
 * cap (subHunksOf), each carrying the rows its lines take wrapped.
 *
 * @param model the pane's state: which file is armed, which section is open
 * @param plan the docked pane's decisions over that state
 * @returns the segments, top to bottom
 */
export function segmentsOf(
  model: PaneState.PaneModel,
  plan: DockPlan,
): Segment[] {
  const { earlier } = plan
  const { columns } = model.place
  const isEmptied = plan.message.length > 0
  const isOpen = model.isPreSessionShown && earlier.length > 0
  const isCapped = earlier.length > Limits.PRE_SESSION_BODY_CAP

  const gutterOf = (hunk: Git.Hunk) =>
    String(
      Math.max(
        1,
        hunk.oldStart + countOf(hunk.lines, line => !line.startsWith('+')) - 1,
        hunk.newStart + countOf(hunk.lines, line => !line.startsWith('-')) - 1,
      ),
    ).length + Limits.GUTTER_CHROME

  function hunkOf(entry: Entries.BodyEntry, hunk: Git.Hunk): Segment {
    const room = Math.max(1, columns - gutterOf(hunk))

    const lineRows = hunk.lines.map(line =>
      Math.max(
        1,
        Math.ceil(
          Layout.cellWidth(
            Layout.sanitizeLine(
              line.slice(1).replaceAll('\t', ' '.repeat(Layout.TAB_WIDTH)),
            ),
          ) / room,
        ),
      ),
    )

    return {
      kind: 'hunk',
      path: entry.path,
      hunk,
      lineRows,
      rows: lineRows.reduce((sum, rows) => sum + rows, 0),
    }
  }

  const splitOf = (hunk: Git.Hunk) =>
    Detail.subHunksOf(
      {
        ...hunk,
        lines: hunk.lines.filter(Git.isBodyLine).map(Detail.drawnLineOf),
      },
      Detail.MAX_CODE_CHARS,
    )

  function fileOf(entry: Entries.BodyEntry): Segment[] {
    const detail = Entries.detailModelOf(entry, model)
    const notes = Detail.placeholderOf(detail)
    const splits = (entry.body?.hunks ?? []).map(splitOf)

    const isTruncated =
      entry.body?.isTruncated === true ||
      splits.some(split => split.isTruncated)

    const body: Segment[] = notes
      ? notes.map(text => ({ kind: 'note', text }))
      : splits.flatMap(split => split.hunks).map(hunk => hunkOf(entry, hunk))

    return [
      { kind: 'rule', path: entry.path },
      {
        kind: 'name',
        name: { ...detail, isTruncated, isAskable: notes === null },
      },
      { kind: 'rule', path: null },
      ...body,
      ...(isTruncated ? [{ kind: 'footer' } as const] : []),
    ]
  }

  const spacedFileOf = (entry: Entries.BodyEntry): Segment[] => [
    ...fileOf(entry),
    { kind: 'blank' },
  ]

  const messageOf = (): Segment[] => [
    { kind: 'blank' },
    ...plan.message.map(text => ({
      kind: 'text' as const,
      text: Layout.sanitizeName(text),
    })),
    { kind: 'blank' },
  ]

  const hiddenNote: Segment = {
    kind: 'text',
    text: `diffs hidden above ${Limits.PRE_SESSION_BODY_CAP} files`,
  }

  const bodiesOf = (): Segment[] =>
    isCapped ? [hiddenNote] : earlier.flatMap(fileOf)

  const openedOf = (): Segment[] => [
    { kind: 'blank' },
    ...earlier.map(entry => ({ kind: 'legend' as const, entry })),
    ...bodiesOf(),
  ]

  return [
    ...(isEmptied ? messageOf() : plan.rows.flatMap(spacedFileOf)),
    ...keptOf([plan.earlierLabel]).map(label => ({
      kind: 'toggle' as const,
      label,
    })),
    ...(isOpen ? openedOf() : []),
  ]
}
