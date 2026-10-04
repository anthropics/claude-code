import Limits from '../../limits'
import type PaneState from '../../pane-state'
import Plan from './plan'

/**
 * The docked pane's place with the list window moved by so many files,
 * clamped to the list (ReplDiffSidebar's scrollSummary).
 *
 * @param model the pane's state
 * @param delta the files to move by, negative toward the top
 * @returns the place
 */
export function listScrolledBy(
  model: PaneState.PaneModel,
  delta: number,
): PaneState.PaneModel['place'] {
  const last = Math.max(
    0,
    Plan.dockPlanOf(model).rows.length - Limits.MAX_SUMMARY_ROWS,
  )

  return {
    ...model.place,
    listStart: Math.max(
      0,
      Math.min(last, Math.min(model.place.listStart, last) + delta),
    ),
  }
}
