import type Git from '../../../hooks/git'

/**
 * The totals of a diff with one file of one added line.
 */
export const ONE_FILE: Git.DiffStats = {
  filesCount: 1,
  linesAdded: 1,
  linesRemoved: 0,
}
