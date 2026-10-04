/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { RenderElement } from 'claude-code'

import type { Kit } from '../../kit'
import Layout from '../../layout'
import { FOOT_ROWS } from './foot-rows'
import type { MessagePane } from './message-pane'

/**
 * The pane while a message stands in for the list (ReplDiffSidebar's
 * centered body): the header, a blank row, the message, the pickers.
 *
 * With nothing listed below and room, the lines sit where the built-in
 * centers them (half the spare rows above), the pickers under them;
 * otherwise all stacks from the top, the pickers over the pre-session line.
 *
 * @param kit the elements, the width, the body's rows
 * @param pane the header block, the message's lines, the pickers, the
 *   pre-session line, and what is listed under it
 * @returns the pane's tree
 */
export function messagePaneOf(kit: Kit, pane: MessagePane): RenderElement {
  const { Box, Text } = kit.ui
  const { top, controls, earlier, rest } = pane

  const lines = pane.message.flatMap(text =>
    Layout.wrappedLines(Layout.sanitizeName(text), kit.columns),
  )

  const drawn = lines.map(line => <Text dimColor>{line}</Text>)
  const controlRows = controls === null ? [] : [controls]
  const earlierRows = earlier === null ? [] : [earlier]

  const isControlsAboveEarlier =
    controlRows.length > 0 || earlierRows.length === 0

  const aboveEarlier = isControlsAboveEarlier
    ? controlRows
    : [<Box height={1} />]

  const footRows = earlier === null ? 0 : FOOT_ROWS
  const middleRows = kit.rows - top.length - 1 - footRows
  const above = Math.floor((middleRows - lines.length) / 2)

  const isCentered =
    rest.length === 0 && middleRows - above - lines.length >= controlRows.length

  if (!isCentered) {
    return (
      <Box flexDirection="column">
        {[
          ...top,
          <Box height={1} />,
          ...drawn,
          ...aboveEarlier,
          ...earlierRows,
          ...rest,
        ]}
      </Box>
    )
  }

  const spacer = above > 0 ? [<Box height={above} />] : []

  const foot = earlierRows.map(row => (
    <Box flexDirection="column" marginTop={1} paddingBottom={1}>
      {row}
    </Box>
  ))

  return (
    <Box flexDirection="column" height={kit.rows}>
      {[
        ...top,
        <Box height={1} />,
        <Box flexDirection="column" height={middleRows} alignItems="center">
          {[...spacer, ...drawn, ...controlRows]}
        </Box>,
        ...foot,
      ]}
    </Box>
  )
}
