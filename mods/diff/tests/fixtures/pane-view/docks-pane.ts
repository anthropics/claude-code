import type { On, RenderElement } from 'claude-code'
import type { Engine } from 'claude-code/testing'

import PaneState from '../../../hooks/pane-state'
import Views from '../../../hooks/views'
import { drawsPane } from './draws-pane.js'
import { VIEW_PANE } from './view-pane.js'

/**
 * The pane docked beneath the plugin over whichever model the test hands
 * next.
 *
 * Each call draws VIEW_PANE through the engine with `paneView` over that
 * model and answers the tree the engine took.
 *
 * @param $ the test's `$`
 * @param on the test's `on`
 * @param overrides kit members that differ from the ordinary ones
 * @returns draws the pane over a model
 */
export function docksPane(
  $: Engine,
  on: On,
  overrides: Partial<Omit<Views.Kit, 'ui'>> = {},
): (model: PaneState.PaneModel) => Promise<RenderElement> {
  let model = PaneState.INITIAL_MODEL

  drawsPane(on, kit => Views.paneView(kit, model, 'dock'), overrides)

  return next => {
    model = next

    return $.ui.render(VIEW_PANE)
  }
}
