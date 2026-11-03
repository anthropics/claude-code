import type Git from '../../../hooks/git'

/**
 * What the folder rebase-apply holds while `git am` owns it: the file
 * `applying`, and no `rebasing`.
 */
export const APPLY_MAILING: readonly (readonly [string, Git.EntryKind])[] = [
  ['applying', 'file'],
]
