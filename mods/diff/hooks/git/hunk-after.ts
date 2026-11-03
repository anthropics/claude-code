import { countOf } from '../count-of'
import type { Hunk } from './types'

/**
 * The hunk less its first so many lines, its starts moved past them so
 * the numbers of the lines kept stay right; whole at 0.
 *
 * @param hunk the hunk, its lines body lines only
 * @param count how many leading lines to drop
 * @returns the rest of the hunk
 */
export function hunkAfter(hunk: Hunk, count: number): Hunk {
  const dropped = hunk.lines.slice(0, count)

  return {
    oldStart: hunk.oldStart + countOf(dropped, line => !line.startsWith('+')),
    newStart: hunk.newStart + countOf(dropped, line => !line.startsWith('-')),
    lines: hunk.lines.slice(count),
  }
}
