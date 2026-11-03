import type Git from '../../../hooks/git'

/**
 * What the folder rebase-apply holds while a rebase owns it: the file
 * `rebasing`.
 */
export const APPLY_REBASING: readonly (readonly [string, Git.EntryKind])[] = [
  ['rebasing', 'file'],
]
