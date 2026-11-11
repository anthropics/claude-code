/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { RenderElement } from 'claude-code'

import Names from '../../names'
import type PaneState from '../../pane-state'
import type { Kit } from '../kit'
import Layout from '../layout'
import { diffStat } from './diff-stat'
import { present } from './present'

/**
 * The pane's first line (ReplDiffSidebar's header row): `N files changed
 * +A -R`, nothing over an empty state, and the pickers at its right edge.
 *
 * The pickers sit where the built-in draws its close mark, so every row
 * below lands where the built-in's does; this pane's mark is the engine's.
 *
 * @param kit the drawing's kit: its elements, and whether to show the close
 *   hint before the pickers, with or without a count
 * @param totals the header's counts, or null when there is nothing to count
 * @param controls the pickers (Sections.controlsView), or null for none
 * @returns the line
 */
export function headerView(
  kit: Kit,
  totals: PaneState.HeaderTotals | null,
  controls: RenderElement | null,
): RenderElement {
  const { Box, Text } = kit.ui

  const countOf = (counted: PaneState.HeaderTotals): RenderElement => (
    <Text wrap="truncate-end">
      <Text bold>{Layout.plural(counted.filesCount, 'file')}</Text>
      {' changed '}
      {diffStat(kit, counted.linesAdded, counted.linesRemoved)}
    </Text>
  )

  /**
   * The empty first box fills line one of this wrapping box, so a hint too
   * wide for the gap wraps to line two, which the height of 1 clips.
   */
  const gap = kit.hasCloseHint ? (
    <Box
      flexGrow={1}
      width={0}
      height={1}
      flexWrap="wrap"
      justifyContent="flex-end"
      overflow="hidden"
    >
      <Box height={1} />
      <Box
        width={Names.HEADER_CLOSE_HINT_TEXT.length}
        marginX={2}
        flexShrink={0}
      >
        <Text dimColor>{Names.HEADER_CLOSE_HINT_TEXT}</Text>
      </Box>
    </Box>
  ) : (
    <Box flexGrow={1} />
  )

  return (
    <Box flexDirection="row" height={1}>
      {present([totals && countOf(totals), gap, controls])}
    </Box>
  )
}
