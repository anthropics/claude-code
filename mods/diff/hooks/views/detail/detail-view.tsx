/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { Kit } from '../kit'
import Layout from '../layout'
import Sections from '../sections'
import { codeBlocksOf } from './code-blocks-of'
import type { DetailModel } from './detail-model'
import { FILE_FRAME_NODES } from './file-frame-nodes'
import { MAX_CODE_CHARS } from './max-code-chars'
import { placeholderOf } from './placeholder-of'
import type Types from './types'

/**
 * One file's detail (DiffDetailView): its name row (nameRow), the
 * built-in's dim rule under it, the body.
 *
 * The body is a placeholder, or the hunks as the engine's diff `Code`
 * blocks (codeBlocksOf) within the room given, then a footer when anything
 * was cut; with it, the room left over.
 *
 * @param kit the elements and the width
 * @param detail the file
 * @param room the room the pane's bodies have left
 * @returns the detail element and the room after it
 */
export function detailView(
  kit: Kit,
  detail: DetailModel,
  room: Types.BodyRoom,
): Types.DrawnDetail {
  const { Box, Text, Code } = kit.ui
  const placeholder = placeholderOf(detail)

  const code = codeBlocksOf(placeholder ? [] : (detail.body?.hunks ?? []), {
    chars: room.chars - Layout.sanitizeName(detail.displayPath).length,
    nodes: room.nodes - FILE_FRAME_NODES,
  })

  const isTruncated = detail.body?.isTruncated === true || code.isTruncated
  const path = Layout.sanitizeName(detail.path).slice(-MAX_CODE_CHARS)

  const footer = isTruncated
    ? [
        <Text dimColor italic>
          … diff truncated (exceeded 400 line limit)
        </Text>,
      ]
    : []

  const notes = (placeholder ?? []).map(line => (
    <Text dimColor italic wrap="wrap">
      {line}
    </Text>
  ))

  const hunks = code.sources.map(source => (
    <Code source={source} format="diff" path={path} />
  ))

  const element = (
    <Box flexDirection="column">
      {[
        Sections.nameRow(kit, {
          ...detail,
          isTruncated,
          isAskable: placeholder === null,
        }),
        Sections.divider(kit),
        ...(placeholder ? notes : hunks),
        ...footer,
      ]}
    </Box>
  )

  return { element, room: code.room }
}
