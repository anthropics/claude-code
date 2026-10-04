/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { RenderElement } from 'claude-code'

import Limits from '../limits'
import Names from '../names'
import type PaneState from '../pane-state'
import { dialogPane } from './dialog-pane'
import { insetOf } from './inset-of'
import type { Kit } from './kit'
import type { PaneSeat } from './pane-seat'
import Sections from './sections'
import { sidebarPane } from './sidebar-pane'

/**
 * The diff pane's body for one `ui.render`: docked, the built-in panel's
 * layout (sidebarPane); inline, its dialog's, or its wider-terminal line.
 *
 * The line only where the session is fullscreen (or not known not to be)
 * and the terminal too narrow to dock, as the built-in shows no panel
 * there; without the fullscreen layout the dialog draws at any width.
 *
 * @param kit the elements, the handlers, the width
 * @param model the pane's state
 * @param seat where the surface seated the pane, and the terminal's width
 * @returns the tree
 */
export function paneView(
  kit: Kit,
  model: PaneState.PaneModel,
  seat: PaneSeat,
): RenderElement {
  const { Box } = kit.ui
  const isDocked = seat.placement === 'dock'

  const isNarrow =
    model.isFullscreen !== false &&
    seat.terminalColumns !== null &&
    seat.terminalColumns < Limits.OPEN_MIN_COLUMNS

  return isDocked ? (
    <Box
      flexDirection="column"
      paddingTop={Limits.PANE_TOP_PAD_ROWS}
      paddingRight={Limits.PANE_RIGHT_PAD_COLUMNS}
    >
      {sidebarPane(insetOf(kit), model)}
    </Box>
  ) : isNarrow ? (
    <Box>{Sections.dimNote(kit, Names.RESIZE_TERMINAL_TEXT)}</Box>
  ) : (
    dialogPane(kit, model)
  )
}
