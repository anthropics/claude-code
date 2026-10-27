/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { RenderElement } from 'claude-code'

import { keptOf } from '../../kept-of'
import type PaneState from '../../pane-state'
import Body from '../body'
import DialogPane from '../dialog-pane'
import type { Kit } from '../kit'
import { preludeOf } from '../prelude-of'
import Sections from '../sections'

/**
 * The docked pane (ReplDiffSidebarBody): header, base or turn line, todo
 * bar and list pinned; beneath them the window over every file's hunks.
 *
 * An empty Button in the header carries the built-in's base chord. The
 * window starts at the row the person scrolled to; with nothing to list
 * and the pre-session section shut, messagePaneOf centers the empty state.
 *
 * @param kit the elements, the handlers, the width, the rows
 * @param model the pane's state
 * @returns the pane's tree
 */
export function sidebarPane(
  kit: Kit,
  model: PaneState.PaneModel,
): RenderElement {
  const { Box, Button } = kit.ui
  const prelude = preludeOf(kit, model)

  if (prelude) {
    return prelude
  }

  const plan = Body.dockPlanOf(model)
  const isListed = plan.message.length === 0

  const isCentered =
    !isListed && !(model.isPreSessionShown && plan.earlier.length > 0)

  const rows = Body.listBlockOf(kit, model, plan)
  const onPress = kit.actions.togglePreSession
  const hasListRows = rows.length > 0

  const top = Sections.present([
    Sections.headerView(
      kit,
      plan.empty ? null : plan.totals,
      <Box flexDirection="row">
        {Sections.present([
          Sections.sourcePicker(kit, model),
          <Button
            key="base"
            plain
            action="app:cycleDiffBase"
            onPress={kit.actions.cycleBase}
          >
            {''}
          </Button>,
        ])}
      </Box>,
    ),
    plan.line === null ? null : Sections.dimNote(kit, plan.line),
    Sections.todoBar(kit, model),
  ])

  if (isCentered) {
    return DialogPane.messagePaneOf(kit, {
      top: [...top, ...rows],
      message: plan.message,
      controls: null,
      earlier:
        keptOf([plan.earlierLabel]).map(label =>
          Sections.toggleRow(kit, 'presession', { label, onPress }),
        )[0] ?? null,
      rest: [],
    })
  }

  const listOf = (): RenderElement =>
    hasListRows ? (
      <Box flexDirection="column" marginTop={1} marginBottom={1}>
        {rows}
      </Box>
    ) : (
      <Box height={1} />
    )

  return (
    <Box flexDirection="column">
      {[
        ...top,
        ...(isListed ? [listOf()] : []),
        ...Body.drawWindow(
          kit,
          Body.bodyLayoutOf(model, plan),
          model.place.top,
        ),
      ]}
    </Box>
  )
}
