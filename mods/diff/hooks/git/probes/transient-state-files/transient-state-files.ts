/**
 * The git-directory files that mean a merge, cherry-pick or revert is under
 * way: the working tree then holds incoming changes, unread.
 */
export const TRANSIENT_STATE_FILES = [
  'MERGE_HEAD',
  'CHERRY_PICK_HEAD',
  'REVERT_HEAD',
] as const
