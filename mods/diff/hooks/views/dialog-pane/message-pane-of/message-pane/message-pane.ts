import type { RenderElement } from 'claude-code'

/**
 * What stands around a message in the pane: the header block, the message,
 * and the pre-session line.
 */
export type MessagePane = {
  top: readonly RenderElement[]
  message: readonly string[]
  earlier: RenderElement | null
}
