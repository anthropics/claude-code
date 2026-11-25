import PaneState from '../../../pane-state'
import type { DetailModel } from '../../detail/detail-model/detail-model'
import type { BodyEntry } from '../body-entry'

/**
 * A listed file as its detail draws it: the entry, whether it is the armed
 * one or a past turn's, and the backend's words for its notes.
 *
 * @param entry the file
 * @param model the pane's state
 * @returns the detail model
 */
export const detailModelOf = (
  entry: BodyEntry,
  model: PaneState.PaneModel,
): DetailModel => ({
  words: model.words,
  path: entry.path,
  displayPath: entry.displayPath,
  isUntracked: entry.isUntracked,
  isBinary: entry.isBinary,
  body: entry.body,
  isArmed: model.armedPath === entry.path,
  isTurnFile: PaneState.pickedTurnOf(model) !== undefined,
})
