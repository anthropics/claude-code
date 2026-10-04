import Limits from '../../../limits'
import type PaneState from '../../../pane-state'

/**
 * The first of the MAX_VISIBLE_FILES rows the dialog lists (DiffFileList's
 * window): centred on the selected file, the first when none is, clamped.
 *
 * @param model the pane's state: the selection
 * @param paths the listed files' paths, in order
 * @returns the first listed row's index
 */
export const dialogWindowOf = (
  model: Pick<PaneState.PaneModel, 'selectedPath'>,
  paths: readonly string[],
): number =>
  Math.max(
    0,
    Math.min(
      paths.length - Limits.MAX_VISIBLE_FILES,
      Math.max(0, paths.indexOf(model.selectedPath ?? '')) -
        Math.floor(Limits.MAX_VISIBLE_FILES / 2),
    ),
  )
