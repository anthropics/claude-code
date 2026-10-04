import type Git from '../../../hooks/git'

/**
 * A git dir listing while `git am` stopped on a conflict: the folder it
 * shares with a rebase by name, and no REBASE_HEAD.
 */
export const MAILING: readonly (readonly [string, Git.EntryKind])[] = [
  ['rebase-apply', 'dir'],
]
