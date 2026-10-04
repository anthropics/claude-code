import type Git from '../../../hooks/git'

/**
 * What every pane-view diff sums to; the file count is replaced by the
 * number of rows a case gives.
 */
export const TOTALS: Git.DiffStats = {
  filesCount: 1,
  linesAdded: 9,
  linesRemoved: 3,
}
