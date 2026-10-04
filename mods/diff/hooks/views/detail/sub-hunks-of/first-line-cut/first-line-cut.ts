import type Git from '../../../../git'
import { hunkHeaderOf } from '../../hunk-header-of'

/**
 * A hunk's first line cut so that it alone, under its header, fits the
 * room: its marker kept, no surrogate pair split.
 *
 * @param hunk the hunk, its first line too long for a sub-hunk of its own
 * @param maxChars the room the one-line sub-hunk's text fits
 * @returns the cut line
 */
export function firstLineCut(hunk: Git.Hunk, maxChars: number) {
  const [first = ''] = hunk.lines

  const kept = first.slice(
    0,
    Math.max(
      1,
      maxChars - 1 - hunkHeaderOf({ ...hunk, lines: [first] }).length,
    ),
  )

  return /[\uD800-\uDBFF]$/u.test(kept) ? kept.slice(0, -1) : kept
}
