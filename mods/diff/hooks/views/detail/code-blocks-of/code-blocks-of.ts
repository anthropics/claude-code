import Git from '../../../git'
import { HUNK_DIVIDER } from '../hunk-divider'
import { HUNK_DIVIDER_NODES } from '../hunk-divider-nodes'
import { hunkSourceOf } from '../hunk-source-of'
import { leadingHunkOf } from '../leading-hunk-of'
import { MAX_BODY_CHARS } from '../max-body-chars'
import { MAX_BODY_NODES } from '../max-body-nodes'
import { MAX_CODE_CHARS } from '../max-code-chars'
import { subHunksOf } from '../sub-hunks-of'
import type Types from '../types'
import { drawnLineOf } from './drawn-line-of'

/**
 * A file's hunks as the sources of `Code` blocks, each at most
 * MAX_CODE_CHARS, hunks sharing a block (the engine's ellipsis between).
 *
 * A new block at a hunk gets HUNK_DIVIDER; a hunk too long for one is split
 * (subHunksOf) into blocks stacked with none. The body stops, truncated, at
 * the whole lines MAX_BODY_CHARS and MAX_BODY_NODES hold, as the host counts.
 *
 * @param hunks the file's hunks
 * @returns the blocks in order, and whether any line was left out or cut
 */
export function codeBlocksOf(hunks: readonly Git.Hunk[]): Types.CodeBody {
  const blocks: Types.CodeBlock[] = []

  let chars = 0
  let nodes = 0
  let isTruncated = false

  for (const hunk of hunks) {
    const lines = hunk.lines.filter(Git.isBodyLine).map(drawnLineOf)
    const split = subHunksOf({ ...hunk, lines }, MAX_CODE_CHARS)
    isTruncated ||= split.isTruncated

    for (const [at, piece] of split.hunks.entries()) {
      const last = blocks.at(-1)
      const source = hunkSourceOf(piece)
      const isHunkStart = at === 0

      const isJoining =
        isHunkStart &&
        last !== undefined &&
        last.source.length + 1 + source.length <= MAX_CODE_CHARS

      const hasDivider = isHunkStart && !isJoining && last !== undefined
      const overhead = isJoining ? 1 : hasDivider ? HUNK_DIVIDER.length : 0

      const addedNodes = isJoining
        ? 0
        : 1 + (hasDivider ? HUNK_DIVIDER_NODES : 0)

      const room = MAX_BODY_CHARS - chars - overhead
      const fitted = source.length <= room ? piece : leadingHunkOf(piece, room)
      const isOverNodes = nodes + addedNodes > MAX_BODY_NODES

      if (isOverNodes || fitted.lines.length === 0) {
        return { blocks, isTruncated: true }
      }

      const text = hunkSourceOf(fitted)

      if (isJoining) {
        blocks.pop()
      }

      blocks.push({
        source: isJoining ? `${last.source}\n${text}` : text,
        hasDivider: isJoining ? last.hasDivider : hasDivider,
      })

      chars += overhead + text.length
      nodes += addedNodes

      if (fitted.lines.length < piece.lines.length) {
        return { blocks, isTruncated: true }
      }
    }
  }

  return { blocks, isTruncated }
}
