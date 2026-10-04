import type Turns from '../../turns'
import type { PaneModel } from '../pane-model'

/**
 * The turn the pane's source names while the transcript still holds it;
 * undefined for the current source or a turn a rewind dropped.
 *
 * @param model the pane's state
 * @returns the picked turn, or undefined
 */
export function pickedTurnOf(model: PaneModel): Turns.TurnDiff | undefined {
  const { source } = model
  const wanted = source.kind === 'turn' ? source.index : null

  return model.turns.find(candidate => candidate.index === wanted)
}
