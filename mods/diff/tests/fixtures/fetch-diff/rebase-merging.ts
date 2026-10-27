import type Git from '../../../hooks/git'

/**
 * A git dir listing while a rebase stopped on a conflict: the commit it
 * stopped at beside the folder the rebase keeps.
 */
export const REBASE_MERGING: readonly (readonly [string, Git.EntryKind])[] = [
  ['REBASE_HEAD', 'file'],
  ['rebase-merge', 'dir'],
]
