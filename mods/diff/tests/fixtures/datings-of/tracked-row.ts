import type Git from '../../../hooks/git'

/**
 * One row under git, a directory deep: past what a root-only walk lists.
 */
export const TRACKED_ROW: Git.FileStat = {
  path: 'deep/x.ts',
  renamedFrom: null,
  added: 1,
  removed: 0,
  isBinary: false,
  isUntracked: false,
  isPreSession: false,
}
