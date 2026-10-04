/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { RenderElement } from 'claude-code'

import type Detail from '../../detail'
import type { Kit } from '../../kit'
import Layout from '../../layout'
import { askKeyOf } from '../ask-key-of'

/**
 * A file's name row over its body (DiffDetailView's first line): the bold
 * name cut from its start, its asides in dim, and its ask Button.
 *
 * The Button reads `asked ✓` while the file is armed; a file with no hunks
 * to attach (a placeholder body) has none.
 *
 * @param kit the elements, the handlers, the width
 * @param name the file, with whether it is truncated, armed and askable
 * @returns the row
 */
export function nameRow(kit: Kit, name: Detail.NamedDetail): RenderElement {
  const { Box, Text, Button } = kit.ui

  const asides = [
    name.isUntracked ? 'untracked' : null,
    name.isTruncated ? 'truncated' : null,
  ].filter(word => word !== null)

  const aside = asides.length === 0 ? '' : ` (${asides.join(', ')})`

  const ask = (
    <Button
      key={askKeyOf(name.path)}
      onPress={() => kit.actions.toggleAsk(name.path)}
    >
      {name.isArmed ? 'asked ✓' : 'ask'}
    </Button>
  )

  return (
    <Box flexDirection="row">
      {[
        <Text bold wrap="truncate-start">
          {Layout.truncateStart(
            Layout.sanitizeName(name.displayPath),
            kit.columns,
          )}
        </Text>,
        <Text dimColor>{aside}</Text>,
        <Box flexGrow={1} />,
        ...(name.isAskable ? [ask] : []),
      ]}
    </Box>
  )
}
