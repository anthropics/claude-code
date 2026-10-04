import PaneState from '../../../pane-state'
import DialogPane from '../../dialog-pane'
import Entries from '../../entries'
import Layout from '../../layout'
import type { DockPlan } from '../types'

/**
 * The docked pane's decisions over a model (ReplDiffSidebarBody's): which
 * rows list, what the header counts, what stands in for an empty list.
 *
 * Over a picked turn the rows are the turn's files and nothing is empty;
 * else the fetch's session rows, its pre-session rows apart. Under the
 * header: the base line outside settled session mode, or the unborn note.
 *
 * @param model the pane's state
 * @returns the plan
 */
export function dockPlanOf(model: PaneState.PaneModel): DockPlan {
  const { data, requestedMode } = model
  const turn = PaneState.pickedTurnOf(model)
  const noise = model.isNoiseShown ? 'shown' : 'hidden'
  const partition = PaneState.partitionOf(data?.files ?? [], noise)
  const face = model.isPreSessionShown ? 'hide' : 'show'

  const totals = turn
    ? PaneState.turnTotalsOf(turn)
    : data
      ? PaneState.headerTotalsOf(data, partition)
      : PaneState.ZERO_TOTALS

  const empty = turn ? null : PaneState.emptyStateOf(model, totals.filesCount)

  const listed = turn
    ? []
    : DialogPane.listBodyOf({ data, partition, totals, empty })

  const notes = listed.flatMap(line => (typeof line === 'string' ? [line] : []))
  const hasRows = turn ? turn.files.length > 0 : notes.length < listed.length

  const entryOf = (file: Parameters<typeof Entries.bodyEntryOf>[0]) =>
    Entries.bodyEntryOf(file, model)

  const rows = turn
    ? turn.files.map(Entries.turnEntryOf)
    : hasRows
      ? partition.shown.map(entryOf)
      : []

  const earlier = turn ? [] : partition.preSession.map(entryOf)
  const hasEarlier = earlier.length > 0

  const isBaseShown =
    data !== null &&
    !data.isUnborn &&
    (requestedMode !== 'session' || data.mode !== 'session')

  const line = turn
    ? `Turn ${turn.index} "${turn.preview}"`
    : isBaseShown
      ? PaneState.modeLabelOf(requestedMode, model)
      : PaneState.unbornNoteOf(model, totals.filesCount)

  return {
    turn,
    partition,
    totals,
    empty,
    line: line === null ? null : Layout.sanitizeName(line),
    rows,
    earlier,
    earlierLabel: hasEarlier
      ? `+${Layout.plural(earlier.length, 'file')} edited before this ` +
        `session (${face})`
      : null,
    notes,
    message: empty ? [empty.headline, ...notes] : hasRows ? [] : notes,
    isUntrackedNoted:
      !turn && data?.isUntrackedWithheld === true && empty === null,
  }
}
