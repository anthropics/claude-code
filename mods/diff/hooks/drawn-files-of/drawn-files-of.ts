import type Git from '../git'
import Limits from '../limits'
import PaneState from '../pane-state'
import Views from '../views'

/**
 * The files whose bodies the pane draws or a press opens: every row its
 * seat lists now.
 *
 * Docked, the listed session rows, then the pre-session rows while their
 * section is open, none past PRE_SESSION_BODY_CAP. Inline, the rows in the
 * dialog's window, none for a turn, whose rows carry their own bodies.
 *
 * @param model the pane's state: its fetch, its seat, its toggles, its pick
 * @returns the rows, none without a fetch
 */
export function drawnFilesOf(
  model: PaneState.PaneModel,
): readonly Git.FileStat[] {
  const files = model.data?.files ?? []

  if (model.placement === 'inline') {
    const isTurn = PaneState.pickedTurnOf(model) !== undefined
    const listed = Views.dialogEntriesOf(model).map(entry => entry.path)
    const start = Views.dialogWindowOf(model, listed)
    const windowed = listed.slice(start, start + Limits.MAX_VISIBLE_FILES)

    return files.filter(file => !isTurn && windowed.includes(file.path))
  }

  const partition = PaneState.partitionOf(
    files,
    model.isNoiseShown ? 'shown' : 'hidden',
  )

  const isBodied =
    model.isPreSessionShown &&
    partition.preSession.length <= Limits.PRE_SESSION_BODY_CAP

  return [...partition.shown, ...(isBodied ? partition.preSession : [])]
}
