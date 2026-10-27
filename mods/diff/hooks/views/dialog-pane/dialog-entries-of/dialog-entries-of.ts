import Git from '../../../git'
import PaneState from '../../../pane-state'
import Entries from '../../entries'

/**
 * The files the dialog lists, in its order: the picked turn's, or every
 * file of the fetch, pre-session or not, sorted by its displayed name.
 *
 * @param model the pane's state
 * @returns the entries
 */
export function dialogEntriesOf(
  model: PaneState.PaneModel,
): readonly Entries.BodyEntry[] {
  const turn = PaneState.pickedTurnOf(model)

  return turn
    ? turn.files.map(Entries.turnEntryOf)
    : [...(model.data?.files ?? [])]
        .sort((a, b) =>
          Git.displayPathOf(a).localeCompare(Git.displayPathOf(b)),
        )
        .map(file => Entries.bodyEntryOf(file, model))
}
