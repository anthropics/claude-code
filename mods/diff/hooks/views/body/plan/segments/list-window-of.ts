import Limits from '../../../../limits'
import type PaneState from '../../../../pane-state'
import type { DockPlan, ListWindow } from '../../types'

/**
 * The docked list's MAX_SUMMARY_ROWS-row window starting at the file the
 * person scrolled it to, clamped so a shrinking list pulls it back.
 *
 * @param model where the person put the list window
 * @param plan the docked pane's rows
 * @returns the window
 */
export function listWindowOf(
  model: Pick<PaneState.PaneModel, 'place'>,
  plan: Pick<DockPlan, 'rows'>,
): ListWindow {
  const first = Math.max(
    0,
    Math.min(model.place.listStart, plan.rows.length - Limits.MAX_SUMMARY_ROWS),
  )

  const shown = plan.rows.slice(first, first + Limits.MAX_SUMMARY_ROWS)

  return {
    shown,
    above: first,
    below: plan.rows.length - first - shown.length,
  }
}
