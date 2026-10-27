/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { RenderElement } from 'claude-code'

import type PaneState from '../../pane-state'
import type { Kit } from '../kit'
import Layout from '../layout'

/**
 * The inline pane's heading (DiffDialog's title line): the title, then
 * its subtitle in dim after a space.
 *
 * @param kit the elements and the width
 * @param heading the title and subtitle
 * @returns the row
 */
export function titleRow(
  kit: Kit,
  heading: PaneState.DialogTitle,
): RenderElement {
  const { Text } = kit.ui
  const hasSubtitle = heading.subtitle !== ''

  return (
    <Text wrap="truncate-end">
      {Layout.sanitizeName(heading.title)}
      <Text dimColor>
        {hasSubtitle ? ` ${Layout.sanitizeName(heading.subtitle)}` : ''}
      </Text>
    </Text>
  )
}
