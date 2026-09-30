import type Git from '../../../hooks/git'

/**
 * A git dir listing while a rebase waits at a `break`: its folder, and no
 * REBASE_HEAD, which git writes only where a commit stopped it.
 */
export const REBASE_PAUSED: readonly (readonly [string, Git.EntryKind])[] = [
  ['rebase-merge', 'dir'],
]
