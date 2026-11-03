import type { RenderInput } from 'claude-code'

/**
 * The diff pane docked on a 160-column terminal, unfocused, 80 columns of
 * body and 30 rows in view, the main conversation showing.
 */
export const PANE: RenderInput<'Pane'> = {
  component: 'Pane',
  surface: 'terminal',
  requestId: 'diff',
  viewport: { columns: 160, rows: 40 },
  props: {
    title: 'Diff',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
}
