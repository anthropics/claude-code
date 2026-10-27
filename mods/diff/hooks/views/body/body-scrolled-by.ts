import type { UiScrollInput } from 'claude-code'

import Limits from '../../limits'
import type PaneState from '../../pane-state'
import Plan from './plan'

/**
 * The docked pane's place after one of the person's scrolls of the body:
 * a wheel tick or arrow three rows, a page key the window, Home/End an end.
 *
 * Told apart by the rows the move asks for against the pane's body and
 * tree, as the engine sizes each; clamped to the body's extent.
 *
 * @param model the pane's state
 * @param scroll the move: its signed rows, the body's rows, the tree's rows
 * @returns the place
 */
export function bodyScrolledBy(
  model: PaneState.PaneModel,
  scroll: Pick<UiScrollInput, 'by' | 'bodyRows' | 'contentRows'>,
): PaneState.PaneModel['place'] {
  const { visibleRows, maxTop } = Plan.bodyLayoutOf(
    model,
    Plan.dockPlanOf(model),
  )

  const size = Math.abs(scroll.by)

  const isEnd =
    size >= scroll.contentRows && scroll.contentRows > scroll.bodyRows

  const isPage = !isEnd && size >= scroll.bodyRows

  const step = isEnd
    ? maxTop
    : isPage
      ? Math.max(1, visibleRows)
      : size * Limits.WHEEL_ROWS

  return {
    ...model.place,
    top: Math.max(
      0,
      Math.min(maxTop, model.place.top + Math.sign(scroll.by) * step),
    ),
  }
}
