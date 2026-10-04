import type Git from '../../../hooks/git'

/**
 * A test file changed this session, which the partition counts as noise.
 */
export const TEST_ROW: Git.FileStat = {
  path: 'test/a.test.ts',
  renamedFrom: null,
  added: 3,
  removed: 1,
  isBinary: false,
  isUntracked: false,
  isPreSession: false,
}
