import type { RenderInput } from 'claude-code'

import { BODY_ROWS } from './body-rows.js'
import { COLUMNS } from './columns.js'

/**
 * A pane the plugin does not own, docked on a 160-column terminal at the
 * view fixtures' body size.
 *
 * Its render passes beneath the plugin to the hook a test draws a view in.
 */
export const VIEW_PANE: RenderInput<'Pane'> = {
  component: 'Pane',
  surface: 'terminal',
  requestId: 'view',
  viewport: { columns: 160, rows: 40 },
  props: {
    title: 'View',
    isFocused: false,
    bodyColumns: COLUMNS,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: BODY_ROWS },
    view: {},
  },
}
