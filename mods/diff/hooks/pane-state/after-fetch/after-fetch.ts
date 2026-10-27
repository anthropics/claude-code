import Todos from '../../todos'
import Turns from '../../turns'
import type { PaneModel } from '../pane-model'
import type { Fetched } from './fetched'

/**
 * The model once a refresh has settled: the outcome's data (kept as it was
 * when the fetch was unavailable), the transcript's turns and todos.
 *
 * @param model the model before the refresh
 * @param fetched what the refresh read
 * @returns the settled model
 */
export function afterFetch(model: PaneModel, fetched: Fetched): PaneModel {
  const { outcome, messages } = fetched
  const isData = outcome.kind === 'data'
  const isKept = outcome.kind === 'unavailable'
  const data = isData ? outcome.data : isKept ? model.data : null

  return {
    ...model,
    isLoading: false,
    hasSettled: true,
    isOutsideRepository: outcome.kind === 'no-repository',
    data,
    turns: Turns.turnDiffsOf(messages),
    todos: Todos.todoProgressOf(messages),
  }
}
