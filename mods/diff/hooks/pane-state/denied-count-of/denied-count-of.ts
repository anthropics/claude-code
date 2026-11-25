import type { PaneModel } from '../pane-model'
import { pickedTurnOf } from '../picked-turn-of'

/**
 * How many files the pane's source leaves out as read-denied: the picked
 * turn's, else the fetch's.
 *
 * @param model the pane's state
 * @returns the count
 */
export function deniedCountOf(model: PaneModel): number {
  const turn = pickedTurnOf(model)

  return turn ? (turn.deniedCount ?? 0) : model.denied.length
}
