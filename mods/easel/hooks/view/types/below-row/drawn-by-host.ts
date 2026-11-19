import type { RenderElement } from 'claude-code'

/**
 * What a render hook holds of the host's own drawing.
 */
export type DrawnByHost = {
  /**
   * The host's row for the call, or null where it drew none.
   */
  hostRow: RenderElement | null
}
