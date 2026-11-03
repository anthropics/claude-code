import type { On, RenderElement } from 'claude-code'

import { isOnPaneSurface } from '../../../hooks/is-on-pane-surface'
import type Views from '../../../hooks/views'
import { BODY_ROWS } from './body-rows.js'
import { COLUMNS } from './columns.js'
import { noopActionsOf } from './noop-actions-of.js'

/**
 * Draws a pane beneath the plugin with a view of the test's, handed the kit
 * every view takes.
 *
 * The hook resolves the surface's elements; the body size is the view
 * fixtures' and the actions do nothing, unless overridden.
 *
 * @param on the test's `on`
 * @param view draws the tree from the kit
 * @param overrides kit members that differ from the ordinary ones
 */
export const drawsPane = (
  on: On,
  view: (kit: Views.Kit) => RenderElement,
  overrides: Partial<Omit<Views.Kit, 'ui'>> = {},
) =>
  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (!isOnPaneSurface(e)) {
      return next(e)
    }

    const { Box, Text, Button, Select, Code } = await $.ui.resolve(e)

    return view({
      ui: { Box, Text, Button, Select, Code },
      actions: noopActionsOf(),
      columns: COLUMNS,
      rows: BODY_ROWS,
      ...overrides,
    })
  })
