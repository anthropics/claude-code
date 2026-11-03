/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { RenderElement } from 'claude-code'

import Limits from '../../limits'
import type PaneState from '../../pane-state'
import type { Kit } from '../kit'

/**
 * The session's todo progress as a bar and `done/total`, drawn only while
 * a todo list exists (ReplDiffSidebar's ProgressBar row).
 *
 * @param kit the elements and the width
 * @param model the pane's state, holding its todos' completed over total
 * @returns the row, or null without todos
 */
export function todoBar(
  kit: Kit,
  model: Pick<PaneState.PaneModel, 'todos'>,
): RenderElement | null {
  const { todos } = model

  if (todos.total === 0) {
    return null
  }

  const { Box, Text } = kit.ui

  const cells = Math.max(
    1,
    Math.min(Limits.TODO_BAR_CELLS, kit.columns - Limits.TODO_BAR_RESERVE),
  )

  const filled = Math.round((todos.done / todos.total) * cells)

  return (
    <Box flexDirection="row" gap={1} marginTop={1}>
      <Text>
        <Text color="success">{'█'.repeat(filled)}</Text>
        <Text color="inactive">{'░'.repeat(Math.max(0, cells - filled))}</Text>
      </Text>
      <Text dimColor>{`${todos.done}/${todos.total}`}</Text>
    </Box>
  )
}
