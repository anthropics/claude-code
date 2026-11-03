import type { UiScrollInput } from 'claude-code'

import Limits from '../../limits'
import type PaneState from '../../pane-state'
import Plan from './plan'

/**
 * Whether a scroll is a wheel tick over the docked list block while the
 * list overflows its window: it moves the list then, as ReplDiffSidebar's.
 *
 * @param model the pane's state
 * @param scroll the move: the cell the wheel was over, absent for keys
 * @returns whether the list takes it
 */
export function isWheelOverList(
  model: PaneState.PaneModel,
  scroll: Pick<UiScrollInput, 'pointer'>,
): boolean {
  const plan = Plan.dockPlanOf(model)
  const { listTop, listEnd } = Plan.bodyLayoutOf(model, plan)
  const row = scroll.pointer?.row ?? -1

  return (
    row >= listTop &&
    row < listEnd &&
    plan.rows.length > Limits.MAX_SUMMARY_ROWS
  )
}
