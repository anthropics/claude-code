import type Git from '../../../../git'
import type PaneState from '../../../../pane-state'

/**
 * What decides the list's body: the fetch, its grouped rows, the header's
 * counts, the empty state when there is one, and whether more is to come.
 */
export type ListPlace = {
  data: Git.DiffData | null
  partition: PaneState.Partition
  totals: PaneState.HeaderTotals
  empty: PaneState.EmptyState | null
  isLoading: boolean
}
