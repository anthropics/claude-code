import Git from '../../../git'
import type { HunkSegment, WindowCut } from '../types'

/**
 * The part of a hunk the window shows: from the line holding its first
 * shown row (hunkAfter renumbers) to the last that starts in the room left.
 *
 * @param segment the hunk and the rows each of its lines takes
 * @param cut the rows hidden above the window and the rows it has left
 * @returns the hunk's shown lines
 */
export function hunkWindowOf(segment: HunkSegment, cut: WindowCut): Git.Hunk {
  let passed = 0
  let first = 0
  let shown = 0
  let last = 0

  for (const rows of segment.lineRows) {
    if (passed + rows <= cut.skip) {
      first += 1
    } else if (shown < cut.take) {
      shown += rows
      last += 1
    }

    passed += rows
  }

  const tail = Git.hunkAfter(segment.hunk, first)

  return { ...tail, lines: tail.lines.slice(0, last) }
}
