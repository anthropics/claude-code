/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { RenderElement } from 'claude-code'

import Limits from '../../limits'
import type Entries from '../entries'
import type { Kit } from '../kit'
import Layout from '../layout'
import { diffStat } from './diff-stat'

/**
 * One row of the open pre-session section's legend (PreSessionSection): the
 * file's dim name cut from its start, its counts at the right; no press.
 *
 * @param kit the elements and the width
 * @param entry the pre-session file
 * @returns the row
 */
export function legendRow(kit: Kit, entry: Entries.BodyEntry): RenderElement {
  const { Box, Text } = kit.ui

  return (
    <Box flexDirection="row">
      {[
        <Text dimColor wrap="truncate-end">
          {Layout.truncateStart(
            Layout.sanitizeName(entry.displayPath),
            Math.max(kit.columns - Limits.STAT_CELLS, Limits.PATH_FLOOR),
          )}
        </Text>,
        <Box flexGrow={1} />,
        diffStat(kit, entry.added, entry.removed),
      ]}
    </Box>
  )
}
