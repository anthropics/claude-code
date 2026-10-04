import type PaneState from '../../pane-state'
import Plan from './plan'

/**
 * The docked pane's place with the body scrolled so this file's block
 * heads the window (the built-in's jump to file); unchanged for no such file.
 *
 * @param model the pane's state
 * @param path the file's path
 * @returns the place
 */
export const placeAtFile = (
  model: PaneState.PaneModel,
  path: string,
): PaneState.PaneModel['place'] => ({
  ...model.place,
  top:
    Plan.bodyLayoutOf(model, Plan.dockPlanOf(model)).tops.get(path) ??
    model.place.top,
})
