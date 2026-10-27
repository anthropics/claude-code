import type Git from '../../hooks/git'

/**
 * The totals of a diff with nothing in it.
 */
export const NO_STATS: Git.DiffStats = {
  filesCount: 0,
  linesAdded: 0,
  linesRemoved: 0,
}
