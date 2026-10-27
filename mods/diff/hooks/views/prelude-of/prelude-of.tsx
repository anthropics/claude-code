/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { RenderElement } from 'claude-code'

import Names from '../../names'
import type PaneState from '../../pane-state'
import DialogPane from '../dialog-pane'
import type { Kit } from '../kit'
import Sections from '../sections'

/**
 * What the pane draws before it has a diff to lay out: the line saying the
 * directory is in no repository, or the first fetch's `Loading diff…`.
 *
 * Null once a fetch settled (or a turn is picked), when the layout draws.
 *
 * @param kit the elements, the width, the rows
 * @param model the pane's state
 * @returns the early tree, or null
 */
export function preludeOf(
  kit: Kit,
  model: Pick<
    PaneState.PaneModel,
    'isOutsideRepository' | 'data' | 'hasSettled' | 'source' | 'turns'
  >,
): RenderElement | null {
  const { Box } = kit.ui
  const isLoading = model.data === null && !model.hasSettled

  const outside = (
    <Box>{Sections.dimNote(kit, Names.NOT_IN_REPOSITORY_TEXT)}</Box>
  )

  const loadingOf = (): RenderElement =>
    DialogPane.messagePaneOf(kit, {
      top: [Sections.headerView(kit, null, null)],
      message: ['Loading diff…'],
      controls: null,
      earlier: null,
      rest: [],
    })

  const settled = isLoading ? loadingOf() : null

  return model.isOutsideRepository ? outside : settled
}
