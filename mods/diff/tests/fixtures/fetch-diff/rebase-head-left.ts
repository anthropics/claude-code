import type Git from '../../../hooks/git'

/**
 * A git dir listing after a rebase that finished: git left REBASE_HEAD behind
 * and removed the rebase's folder.
 */
export const REBASE_HEAD_LEFT: readonly (readonly [string, Git.EntryKind])[] = [
  ['REBASE_HEAD', 'file'],
]
