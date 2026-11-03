/**
 * What leads every git child's argv once the linked worktree is pinned:
 * its own git dir and its working tree.
 */
export const PINNED_LEAD: readonly string[] = [
  'git',
  '--git-dir=/main/.git/worktrees/wt',
  '--work-tree=/main/wt',
]
