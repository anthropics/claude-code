/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { RenderElement } from 'claude-code'

import type { Kit } from '../../kit'
import type { KeyedPressable } from '../keyed-pressable'

/**
 * One list row: a plain Button as wide as its label, a spacer, then the
 * tail at the right edge (the counts, or a note).
 *
 * @param kit the elements
 * @param row the Button's key, label, press, rest style and ring start
 * @param tail what sits at the row's right edge
 * @returns the row element
 */
export function listRow(
  kit: Kit,
  row: KeyedPressable,
  tail: RenderElement,
): RenderElement {
  const { Box, Button } = kit.ui

  return (
    <Box flexDirection="row">
      <Button
        key={row.key}
        plain
        dimColor={row.isDim}
        {...(row.isAutoFocus ? ({ autoFocus: true } as const) : {})}
        onPress={row.onPress}
      >
        {row.label}
      </Button>
      <Box flexGrow={1} />
      {tail}
    </Box>
  )
}
