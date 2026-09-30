import type Git from '../../../hooks/git'

/**
 * A git dir listing whose rebase-merge is a symbolic link beside a
 * REBASE_HEAD, so no rebase is under way as far as the fetch is concerned.
 */
export const REBASE_LINKED: readonly (readonly [string, Git.EntryKind])[] = [
  ['REBASE_HEAD', 'file'],
  ['rebase-merge', 'other'],
]
