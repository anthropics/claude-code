import type Git from '../../../hooks/git'

/**
 * A source file changed this session: three added, one removed.
 */
export const SESSION_ROW: Git.FileStat = {
  path: 'src/a.ts',
  renamedFrom: null,
  added: 3,
  removed: 1,
  isBinary: false,
  isUntracked: false,
  isPreSession: false,
}
