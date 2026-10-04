/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { RenderElement } from 'claude-code'

import type { Kit } from '../../kit'

/**
 * `+N -M` in the diff's word colours, a side left out at zero and nothing
 * at all at 0/0 (design-system DiffStat).
 *
 * @param kit the drawing's kit; its elements draw the counts
 * @param added lines added
 * @param removed lines removed
 * @returns the inline element
 */
export function diffStat(
  kit: Kit,
  added: number,
  removed: number,
): RenderElement {
  const { Text } = kit.ui
  const hasBoth = added > 0 && removed > 0

  return (
    <Text>
      {added > 0 ? <Text color="diffAddedWord">{`+${added}`}</Text> : ''}
      {hasBoth ? ' ' : ''}
      {removed > 0 ? <Text color="diffRemovedWord">{`-${removed}`}</Text> : ''}
    </Text>
  )
}
