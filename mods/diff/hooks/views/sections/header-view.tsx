/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { RenderElement } from 'claude-code'

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
 * @param kit the drawing's kit; its elements draw the line
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

  return (
    <Box flexDirection="row" height={1}>
      {present([totals && countOf(totals), <Box flexGrow={1} />, controls])}
    </Box>
  )
}
