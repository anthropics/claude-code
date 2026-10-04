import type Git from '../../../git'
import { hunkHeaderOf } from '../hunk-header-of'

/**
 * The most of a hunk's first lines whose text (hunkSourceOf) fits the
 * room, whole lines only: none when the first line alone does not fit.
 *
 * @param hunk the hunk, its lines body lines only
 * @param maxChars the room, in UTF-16 units
 * @returns the hunk cut to those lines, its starts unchanged
 */
export function leadingHunkOf(hunk: Git.Hunk, maxChars: number): Git.Hunk {
  let bodyChars = 0
  let taken = 0

  for (const line of hunk.lines) {
    const header = hunkHeaderOf({
      ...hunk,
      lines: hunk.lines.slice(0, taken + 1),
    })

    bodyChars += 1 + line.length

    if (header.length + bodyChars > maxChars) {
      break
    }

    taken += 1
  }

  return { ...hunk, lines: hunk.lines.slice(0, taken) }
}
