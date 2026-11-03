/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { RenderElement } from 'claude-code'

import type { Kit } from '../../kit'

/**
 * One dim line of the pane: a hint, an elision count, a base label.
 *
 * @param kit the drawing's kit; its elements draw the line
 * @param text the line
 * @returns the element
 */
export function dimNote(kit: Kit, text: string): RenderElement {
  const { Text } = kit.ui

  return (
    <Text dimColor wrap="truncate-end">
      {text}
    </Text>
  )
}
