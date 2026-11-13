import type { ResultOf } from 'claude-code'

/**
 * What an engine answers an open it leaves waiting undrawn: the plugin
 * opened unasked on a terminal narrower than an unrequested pane is given.
 */
export const LEFT_WAITING: ResultOf['ui.open'] = {
  value: {
    isPlaced: false,
    reason:
      'unasked below 144 columns (120 now): placed when the person opens ' +
      'it, or when the terminal is widened to 144 columns',
  },
}
