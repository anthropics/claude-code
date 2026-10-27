import type Git from '../../../hooks/git'

/**
 * A git dir listing mid-merge: MERGE_HEAD is a plain file.
 */
export const MERGING: readonly (readonly [string, Git.EntryKind])[] = [
  ['MERGE_HEAD', 'file'],
]
