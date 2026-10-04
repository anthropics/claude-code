import type { UiScrollInput } from 'claude-code'

import { PANE } from './pane.js'

/**
 * One tick of the person's wheel toward the foot over the docked pane, as
 * the engine raises it before anything moves.
 */
export const WHEEL_TICK: UiScrollInput = {
  component: 'Pane',
  requestId: PANE.requestId,
  offset: 1,
  by: 1,
  bodyRows: PANE.props.scroll.bodyRows,
  contentRows: PANE.props.scroll.bodyRows + 1,
  origin: { kind: 'person' },
}
