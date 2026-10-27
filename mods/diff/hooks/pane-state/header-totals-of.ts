import type Git from '../git'
import type { HeaderTotals } from './header-totals'
import type { Partition } from './partition'

/**
 * The header's counts (ReplDiffSidebar): the fetched totals less the
 * pre-session rows, and how many session files fell past the row cap.
 *
 * Files past the cap were never dated, so they always count and always
 * show as `notShown`: an edit that sorts after fifty older ones stays seen.
 *
 * @param data the fetch
 * @param partition its rows, grouped
 * @returns the counts and how many session files are past the cap
 */
export function headerTotalsOf(
  data: Git.DiffData,
  partition: Partition,
): HeaderTotals {
  const { stats, files } = data
  const before = partition.preSession
  const filesCount = stats.filesCount - before.length

  return {
    filesCount,
    linesAdded:
      stats.linesAdded - before.reduce((sum, file) => sum + file.added, 0),
    linesRemoved:
      stats.linesRemoved - before.reduce((sum, file) => sum + file.removed, 0),
    notShown: Math.max(0, filesCount - (files.length - before.length)),
  }
}
