import type PaneState from '../../../pane-state'
import type Turns from '../../../turns'
import type Entries from '../../entries'

/**
 * What the docked pane decided before drawing: the turn or fetch it shows,
 * its rows and counts, the empty state, the lines round the list.
 *
 * `message` holds the lines that stand in for the list (an empty state, a
 * too-many or only-noise state); `line` the turn's preview, base line or
 * no-commits note, printable; `earlierLabel` the pre-session grey line.
 */
export type DockPlan = {
  turn: Turns.TurnDiff | undefined
  partition: PaneState.Partition
  totals: PaneState.HeaderTotals
  empty: PaneState.EmptyState | null
  line: string | null
  rows: readonly Entries.BodyEntry[]
  earlier: readonly Entries.BodyEntry[]
  earlierLabel: string | null
  notes: readonly string[]
  message: readonly string[]
  isUntrackedNoted: boolean
}
