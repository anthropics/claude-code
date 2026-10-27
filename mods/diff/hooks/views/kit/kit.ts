import type { PaneActions } from '../pane-actions'
import type { Ui } from './ui'

/**
 * What every part of one drawing is handed.
 *
 * The surface's elements, the controls' handlers, the body's width
 * (`props.bodyColumns`) and its rows (`props.scroll.bodyRows`).
 */
export type Kit = {
  ui: Ui
  actions: PaneActions
  columns: number
  rows: number
}
