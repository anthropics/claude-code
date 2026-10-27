import type Git from '../../../hooks/git'

/**
 * A git dir listing while a rebase that applies patches stopped on a
 * conflict; its folder holds APPLY_REBASING.
 */
export const REBASE_APPLYING: readonly (readonly [string, Git.EntryKind])[] = [
  ['REBASE_HEAD', 'file'],
  ['rebase-apply', 'dir'],
]
