import type Types from '../../types'

/**
 * The argv that leads every git child once the repository is pinned: its
 * git directory and working tree named, as the built-in panel pins them.
 *
 * With `--git-dir` given git discovers nothing from its cwd, so a nested
 * repository the shell later moves into is never the one read.
 *
 * @param repository the session's pinned repository
 * @returns the leading argv
 */
export const pinnedLeadOf = (
  repository: Types.Repository,
): readonly string[] => [
  `--git-dir=${repository.gitDir}`,
  `--work-tree=${repository.toplevel}`,
]
