import type { RenderElement } from 'claude-code'

/**
 * What stands around a message in the pane: the header block, the message,
 * the pickers, the pre-session line, and what is listed under it.
 */
export type MessagePane = {
  top: readonly RenderElement[]
  message: readonly string[]
  controls: RenderElement | null
  earlier: RenderElement | null
  rest: readonly RenderElement[]
}
