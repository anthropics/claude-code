/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { RenderElement } from 'claude-code'

import Limits from '../../../limits'
import type { Kit } from '../../kit'
import Layout from '../../layout'
import { diffStat } from '../diff-stat'
import type { FileRowModel } from '../file-row-model'
import { listRow } from '../list-row'
import { POINTER } from '../pointer'

/**
 * One file of the inline list (DiffFileList FileItem): the pointer before
 * the selected one, where the focus ring starts, the name, counts or note.
 *
 * @param kit the elements, the handlers, the width
 * @param row the file
 * @param onPress selects the file
 * @returns the row element
 */
export function dialogFileRow(
  kit: Kit,
  row: FileRowModel,
  onPress: () => void,
): RenderElement {
  const { Text } = kit.ui

  const room = Math.max(
    Limits.DIALOG_PATH_FLOOR,
    kit.columns - Limits.DIALOG_PATH_RESERVE,
  )

  const mark = row.isSelected ? POINTER : ' '
  const name = Layout.truncateStart(Layout.sanitizeName(row.displayPath), room)

  const note = (
    <Text dimColor italic>
      {row.note ?? ''}
    </Text>
  )

  const hasNote = row.note !== null
  const tail = hasNote ? note : diffStat(kit, row.added, row.removed)

  return listRow(
    kit,
    {
      key: row.key,
      label: `${mark} ${name}`,
      onPress,
      isDim: false,
      isAutoFocus: row.isSelected,
    },
    tail,
  )
}
