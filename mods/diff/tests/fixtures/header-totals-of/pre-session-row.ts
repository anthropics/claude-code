import type Git from '../../../hooks/git'

/**
 * A file last changed before the session: its lines leave the header.
 */
export const PRE_SESSION_ROW: Git.FileStat = {
  path: 'old.ts',
  renamedFrom: null,
  added: 5,
  removed: 1,
  isBinary: false,
  isUntracked: false,
  isPreSession: true,
}
