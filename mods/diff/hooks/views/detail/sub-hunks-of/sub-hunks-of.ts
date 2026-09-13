import { countOf } from '../../../count-of'
import type Git from '../../../git'
import { leadingHunkOf } from '../leading-hunk-of'
import { firstLineCut } from './first-line-cut'

/**
 * A hunk as consecutive sub-hunks whose texts (hunkSourceOf) each fit the
 * room, each starting where the last left off, so the counts add up.
 *
 * A line too long for a sub-hunk of its own is cut to fit, not dropped, and
 * `isTruncated` says so; a hunk that fits comes back whole.
 *
 * @param hunk the hunk, its lines body lines only
 * @param maxChars the room each sub-hunk's text fits, in UTF-16 units
 * @returns the sub-hunks in order, and whether a line was cut
 */
export function subHunksOf(
  hunk: Git.Hunk,
  maxChars: number,
): Pick<Git.FileHunks, 'hunks' | 'isTruncated'> {
  const hunks: Git.Hunk[] = []

  let rest = hunk
  let isTruncated = false

  while (rest.lines.length > 0) {
    const leading = leadingHunkOf(rest, maxChars)
    const isLineCut = leading.lines.length === 0

    const piece = isLineCut
      ? { ...rest, lines: [firstLineCut(rest, maxChars)] }
      : leading

    const taken = rest.lines.slice(0, piece.lines.length)

    hunks.push(piece)
    isTruncated ||= isLineCut

    rest = {
      oldStart: rest.oldStart + countOf(taken, line => !line.startsWith('+')),
      newStart: rest.newStart + countOf(taken, line => !line.startsWith('-')),
      lines: rest.lines.slice(piece.lines.length),
    }
  }

  return { hunks, isTruncated }
}
