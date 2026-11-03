import type { On, RenderElement } from 'claude-code'
import type { Engine } from 'claude-code/testing'

import type PaneState from '../../../hooks/pane-state'
import { docksPane } from './docks-pane.js'

/**
 * The pane docked beneath the plugin over one model, drawn once through the
 * engine: the tree the engine took.
 *
 * @param $ the test's `$`
 * @param on the test's `on`
 * @param model the pane's model
 * @returns the tree
 */
export const dockedPane = (
  $: Engine,
  on: On,
  model: PaneState.PaneModel,
): Promise<RenderElement> => docksPane($, on)(model)
