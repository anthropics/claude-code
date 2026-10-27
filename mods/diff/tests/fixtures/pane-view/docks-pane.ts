import type { On, RenderElement } from 'claude-code'
import type { Engine } from 'claude-code/testing'

import PaneState from '../../../hooks/pane-state'
import Views from '../../../hooks/views'
import { drawsPane } from './draws-pane.js'
import { VIEW_PANE } from './view-pane.js'

/**
 * The pane seated beneath the plugin over whichever model the test hands
 * next: docked on a 160-column terminal unless the overrides say inline.
 *
 * Each call draws VIEW_PANE through the engine with `paneView` over that
 * model and answers the tree the engine took.
 *
 * @param $ the test's `$`
 * @param on the test's `on`
 * @param overrides kit members and the seat that differ from the ordinary
 * @returns draws the pane over a model
 */
export function docksPane(
  $: Engine,
  on: On,
  overrides: Partial<Omit<Views.Kit, 'ui'> & Views.PaneSeat> = {},
): (model: PaneState.PaneModel) => Promise<RenderElement> {
  const {
    placement = 'dock',
    terminalColumns = VIEW_PANE.viewport?.columns ?? null,
    ...kit
  } = overrides

  const seat: Views.PaneSeat = { placement, terminalColumns }

  let model = PaneState.INITIAL_MODEL

  drawsPane(on, drawn => Views.paneView(drawn, model, seat), kit)

  return next => {
    model = next

    return $.ui.render(VIEW_PANE)
  }
}
