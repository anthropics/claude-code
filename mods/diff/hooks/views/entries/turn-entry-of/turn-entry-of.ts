import type Turns from '../../../turns'
import type { BodyEntry } from '../body-entry'

/**
 * A turn's file as the pane draws it: its hunks come from the transcript,
 * so its body is always in hand.
 *
 * @param file the turn's file
 * @returns the entry
 */
export const turnEntryOf = (file: Turns.TurnFile): BodyEntry => ({
  path: file.path,
  displayPath: file.path,
  added: file.added,
  removed: file.removed,
  isUntracked: false,
  isBinary: false,
  body: { hunks: file.hunks, isTruncated: file.isTruncated, isLarge: false },
})
