import type { RenderInput } from 'claude-code'

import { INLINE_PANE } from './inline-pane.js'

/**
 * The diff pane seated inline on a 100-column terminal: too narrow for the
 * built-in panel, which shows only its wider-terminal line there.
 */
export const NARROW_INLINE_PANE: RenderInput<'Pane'> = {
  ...INLINE_PANE,
  viewport: { columns: 100, rows: 30 },
  props: { ...INLINE_PANE.props, bodyColumns: 96 },
}
