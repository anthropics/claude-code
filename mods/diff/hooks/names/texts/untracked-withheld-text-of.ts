import type PaneState from '../../pane-state'

/**
 * The pane's word for a fetch whose untracked listing the backend did not
 * give whole: the tracked rows stand, the new files are not counted.
 *
 * @param model the pane's state, its words naming the program that lists them
 * @returns the note
 */
export const untrackedWithheldTextOf = (
  model: Pick<PaneState.PaneModel, 'words'>,
) =>
  `Untracked files unavailable (${model.words.lister} could not list them); ` +
  'not counted'
