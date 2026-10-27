/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { RenderElement } from 'claude-code'

import type { Kit } from '../../kit'

/**
 * The docked list's `more above` or `more below` row as a dim plain Button
 * that moves its window a file, under the built-in's list keys too.
 *
 * @param kit the elements and the handlers
 * @param edge which edge, the Button's key
 * @param label the row's text
 * @returns the Button
 */
export function listEdgeButton(
  kit: Kit,
  edge: 'list-up' | 'list-down',
  label: string,
): RenderElement {
  const { Button } = kit.ui
  const isUp = edge === 'list-up'

  return (
    <Button
      key={edge}
      plain
      dimColor
      action={isUp ? 'app:diffFileListUp' : 'app:diffFileListDown'}
      onPress={() => kit.actions.scrollList(isUp ? -1 : 1)}
    >
      {label}
    </Button>
  )
}
