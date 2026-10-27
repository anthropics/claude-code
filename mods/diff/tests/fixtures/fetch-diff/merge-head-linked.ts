import type Git from '../../../hooks/git'

/**
 * A git dir listing whose MERGE_HEAD is a symbolic link, so no merge is in
 * progress as far as the fetch is concerned.
 */
export const MERGE_HEAD_LINKED: readonly (readonly [string, Git.EntryKind])[] =
  [['MERGE_HEAD', 'other']]
