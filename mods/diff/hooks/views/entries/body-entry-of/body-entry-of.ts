import Git from '../../../git'
import type PaneState from '../../../pane-state'
import type { BodyEntry } from '../body-entry'

/**
 * A fetched row as the pane draws it, its body looked up in what the pane
 * has read.
 *
 * @param file the row
 * @param model the pane's state, holding the bodies read and the words
 * @returns the entry
 */
export const bodyEntryOf = (
  file: Git.FileStat,
  model: Pick<PaneState.PaneModel, 'bodies' | 'words'>,
): BodyEntry => ({
  path: file.path,
  displayPath: (model.words.drawnOf ?? String)(Git.displayPathOf(file)),
  added: file.added,
  removed: file.removed,
  isUntracked: file.isUntracked,
  isBinary: file.isBinary,
  body: model.bodies.get(file.path),
})
