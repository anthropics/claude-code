import type Backend from '../../backend'
import type Git from '../../git'
import type Todos from '../../todos'
import type Turns from '../../turns'
import type { Bodies } from '../bodies'
import type { Source } from '../source'

/**
 * Everything one drawing of the pane reads.
 *
 * The last good fetch, what the person picked, the bodies read so far, the
 * turns and todos, how the surface seated it, whether the layout docks a
 * pane (once a drawing or `/diff` said), the dialog's view, and the docked
 * scroll in its last box.
 */
export type PaneModel = {
  words: Backend.BackendWords
  baseModes: readonly Git.BaseMode[]
  isLoading: boolean
  hasSettled: boolean
  isOutsideRepository: boolean
  data: Git.DiffData | null
  requestedMode: Git.BaseMode
  selectedPath: string | null
  isNoiseShown: boolean
  isPreSessionShown: boolean
  source: Source
  turns: readonly Turns.TurnDiff[]
  bodies: Bodies
  todos: Todos.TodoProgress
  armedPath: string | null
  placement: 'dock' | 'inline'
  isFullscreen: boolean | null
  dialogView: 'list' | 'detail'
  place: { top: number; listStart: number; columns: number; rows: number }
}
