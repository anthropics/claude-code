import type Git from '../git'
import type { HeaderTotals } from './header-totals'
import type { Partition } from './partition'

/**
 * The header's counts (ReplDiffSidebar): the fetched totals less the
 * pre-session rows, and how many session files fell past the row cap.
 *
 * Files past the cap were never dated, so they always count and always
 * show as `notShown`: an edit that sorts after fifty older ones stays seen.
 * So do the rows not answered for, whose lines are not counted.
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
  const { preSession, denied, unchecked } = partition
  const left = [...denied, ...unchecked].filter(file => file.isPreSession)
  const before = [...preSession, ...left]
  const waiting = unchecked.filter(file => !file.isPreSession)
  const stored = files.length + denied.length + unchecked.length
  const uncounted = [...before, ...waiting]
  const filesCount = stats.filesCount - before.length

  return {
    filesCount,
    linesAdded:
      stats.linesAdded - uncounted.reduce((sum, file) => sum + file.added, 0),
    linesRemoved:
      stats.linesRemoved -
      uncounted.reduce((sum, file) => sum + file.removed, 0),
    notShown:
      Math.max(0, filesCount - (stored - before.length)) + waiting.length,
  }
}
