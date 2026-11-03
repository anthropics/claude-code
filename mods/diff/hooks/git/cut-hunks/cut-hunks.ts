import Limits from '../../limits'
import type Types from '../types'

/**
 * Hunks with their lines cut at MAX_LINES_PER_FILE in all, in order, and
 * whether any line was dropped.
 *
 * The one bound on every body the pane draws or attaches, whether git
 * printed it or the transcript carried it.
 *
 * @param hunks the hunks as parsed or reported
 * @returns the cut hunks and whether the cut dropped lines
 */
export function cutHunks(
  hunks: readonly Types.Hunk[],
): Pick<Types.FileHunks, 'hunks' | 'isTruncated'> {
  let budget = Limits.MAX_LINES_PER_FILE
  let total = 0

  return {
    hunks: hunks.map(hunk => {
      const lines = hunk.lines.slice(0, budget)
      budget -= lines.length
      total += hunk.lines.length

      return { ...hunk, lines }
    }),
    isTruncated: total > Limits.MAX_LINES_PER_FILE,
  }
}
