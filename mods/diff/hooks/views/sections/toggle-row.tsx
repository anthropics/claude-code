/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { RenderElement } from 'claude-code'

import type { Kit } from '../kit'
import type { Pressable } from './pressable'

/**
 * A clickable line that shows or hides a group (ReplDiffSidebar's
 * NoiseFilterToggle and pre-session header), as a plain Button.
 *
 * @param kit the drawing's kit; its elements draw the row
 * @param key the Button's address
 * @param pressable the line's text, `(show)` or `(hide)` in it, and its press
 * @returns the row
 */
export function toggleRow(
  kit: Kit,
  key: string,
  pressable: Pressable,
): RenderElement {
  const { Box, Button } = kit.ui

  return (
    <Box flexDirection="row">
      <Button key={key} plain dimColor onPress={pressable.onPress}>
        {pressable.label}
      </Button>
    </Box>
  )
}
