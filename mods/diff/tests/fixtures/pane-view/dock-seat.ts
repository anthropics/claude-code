import type Views from '../../../hooks/views'
import { VIEW_PANE } from './view-pane.js'

/**
 * VIEW_PANE's seat: docked beside the transcript on its 160-column terminal.
 */
export const DOCK_SEAT: Views.PaneSeat = {
  placement: 'dock',
  terminalColumns: VIEW_PANE.viewport?.columns ?? null,
}
