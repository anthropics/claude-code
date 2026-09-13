import type Views from '../../../hooks/views'
import { noop } from './noop.js'

/**
 * Pane actions that each do nothing, for a tree drawn only to be read.
 *
 * @returns the actions
 */
export const noopActionsOf = (): Views.PaneActions => ({
  selectFile: noop,
  toggleNoise: noop,
  togglePreSession: noop,
  chooseBase: noop,
  chooseSource: noop,
  toggleAsk: noop,
  close: noop,
})
