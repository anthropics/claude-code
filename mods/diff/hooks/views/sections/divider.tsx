/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { RenderElement } from 'claude-code'

import type { Kit } from '../kit'

/**
 * A dim rule across the body: between the list and the selected file, and
 * under that file's name.
 *
 * @param kit the elements and the width
 * @returns the rule
 */
export function divider(kit: Kit): RenderElement {
  const { Text } = kit.ui

  return (
    <Text dimColor wrap="truncate-end">
      {'─'.repeat(Math.max(1, kit.columns))}
    </Text>
  )
}
