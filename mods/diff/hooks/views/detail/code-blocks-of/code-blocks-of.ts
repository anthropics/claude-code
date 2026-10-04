import Git from '../../../git'
import { hunkSourceOf } from '../hunk-source-of'
import { leadingHunkOf } from '../leading-hunk-of'
import { MAX_CODE_CHARS } from '../max-code-chars'
import { subHunksOf } from '../sub-hunks-of'
import type Types from '../types'
import { drawnLineOf } from './drawn-line-of'

/**
 * A file's hunks as the sources of `Code` blocks, one a hunk, stacked with
 * nothing between as the built-in stacks a file's hunks.
 *
 * A hunk longer than MAX_CODE_CHARS is split (subHunksOf) into several. The
 * body stops, truncated, at the whole lines the room holds as the host
 * counts, a block a node; the room left comes back.
 *
 * @param hunks the file's hunks
 * @param room the characters and nodes the pane's bodies have left
 * @returns the sources in order, whether any line was left out or cut, and
 *   the room after them
 */
export function codeBlocksOf(
  hunks: readonly Git.Hunk[],
  room: Types.BodyRoom,
): Types.CodeBody {
  const sources: string[] = []

  let chars = 0
  let isTruncated = false

  const left = (): Types.BodyRoom => ({
    chars: room.chars - chars,
    nodes: room.nodes - sources.length,
  })

  for (const hunk of hunks) {
    const lines = hunk.lines.filter(Git.isBodyLine).map(drawnLineOf)
    const split = subHunksOf({ ...hunk, lines }, MAX_CODE_CHARS)
    isTruncated ||= split.isTruncated

    for (const piece of split.hunks) {
      const fits = room.chars - chars
      const isWhole = hunkSourceOf(piece).length <= fits
      const fitted = isWhole ? piece : leadingHunkOf(piece, fits)
      const isOverNodes = sources.length + 1 > room.nodes

      if (isOverNodes || fitted.lines.length === 0) {
        return { sources, isTruncated: true, room: left() }
      }

      const text = hunkSourceOf(fitted)
      sources.push(text)
      chars += text.length

      if (fitted.lines.length < piece.lines.length) {
        return { sources, isTruncated: true, room: left() }
      }
    }
  }

  return { sources, isTruncated, room: left() }
}
