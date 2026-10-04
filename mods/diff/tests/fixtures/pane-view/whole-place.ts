import type PaneState from '../../../hooks/pane-state'
import { COLUMNS } from './columns.js'

/**
 * The docked pane's place in a box tall enough that its window holds every
 * row a test's few files draw: nothing scrolled, the list at its top.
 */
export const WHOLE_PLACE: PaneState.PaneModel['place'] = {
  top: 0,
  listStart: 0,
  columns: COLUMNS,
  rows: 1_000,
}
