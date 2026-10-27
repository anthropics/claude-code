import type { RenderElement } from 'claude-code'

import Limits from '../../../limits'
import type { Kit } from '../../kit'
import Layout from '../../layout'
import { diffStat } from '../diff-stat'
import type { FileRowModel } from '../file-row-model'
import { listRow } from '../list-row'
import { statTextOf } from '../stat-text-of'

/**
 * One file of the docked list (ReplDiffSidebar FileSummaryRow): the
 * start-truncated name as a plain Button, its counts at the right.
 *
 * Nothing at the right at 0/0 (an untracked or binary file). The label is
 * padded up to the counts, so the whole row before them presses.
 *
 * @param kit the elements, the handlers, the width
 * @param row the file
 * @param onPress scrolls the body to the file
 * @returns the row element
 */
export function fileRow(
  kit: Kit,
  row: FileRowModel,
  onPress: () => void,
): RenderElement {
  const label = Layout.padEnd(
    Layout.truncateStart(
      Layout.sanitizeName(row.displayPath),
      Math.max(kit.columns - Limits.STAT_CELLS, Limits.PATH_FLOOR),
    ),
    kit.columns - statTextOf(row.added, row.removed).length,
  )

  return listRow(
    kit,
    { key: row.key, label, onPress, isDim: true, isAutoFocus: false },
    diffStat(kit, row.added, row.removed),
  )
}
