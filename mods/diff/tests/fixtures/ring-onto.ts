import type { UiFocusInput } from 'claude-code'

import { PANE } from './pane.js'

/**
 * The person walking the pane's focus ring onto one of the plugin's
 * elements, as the engine raises it before the ring moves.
 *
 * @param key the element's key
 * @param plugin the name the engine stamped on the element
 * @returns the `ui.focus` input
 */
export const ringOnto = (key: string, plugin = 'diff'): UiFocusInput => ({
  component: 'Pane',
  requestId: PANE.requestId,
  plugin,
  element: key,
  origin: { kind: 'person' },
})
