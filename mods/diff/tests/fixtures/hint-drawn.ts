import type { RenderElement } from 'claude-code'

/**
 * What the engine draws for the hint, standing in beneath the plugin.
 */
export const HINT_DRAWN: RenderElement = {
  type: 'Text',
  children: ['? for shortcuts'],
}
