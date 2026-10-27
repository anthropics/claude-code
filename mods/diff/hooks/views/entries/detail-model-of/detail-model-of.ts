import type PaneState from '../../../pane-state'
import type Detail from '../../detail'
import type { BodyEntry } from '../body-entry'

/**
 * A listed file as its detail draws it: the entry, whether it is the armed
 * one, and the backend's words for its notes.
 *
 * @param entry the file
 * @param model which file is armed, and the backend's words
 * @returns the detail model
 */
export const detailModelOf = (
  entry: BodyEntry,
  model: Pick<PaneState.PaneModel, 'armedPath' | 'words'>,
): Detail.DetailModel => ({
  words: model.words,
  path: entry.path,
  displayPath: entry.displayPath,
  isUntracked: entry.isUntracked,
  isBinary: entry.isBinary,
  body: entry.body,
  isArmed: model.armedPath === entry.path,
})
