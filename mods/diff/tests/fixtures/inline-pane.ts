import type { RenderInput } from 'claude-code'

import { PANE } from './pane.js'

/**
 * The diff pane seated inline above the prompt on a 160-column terminal,
 * as a session without the fullscreen layout seats it.
 */
export const INLINE_PANE: RenderInput<'Pane'> = {
  ...PANE,
  props: { ...PANE.props, placement: 'inline', bodyColumns: 156 },
}
