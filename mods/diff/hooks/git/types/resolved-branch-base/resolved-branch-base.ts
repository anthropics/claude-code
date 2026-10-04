/**
 * What branch mode diffs against once it resolved: the merge-base with the
 * default branch, HEAD itself when it is that base, or nothing defensible.
 */
export type ResolvedBranchBase =
  | { kind: 'merge-base'; mergeBase: string; baseBranch: string }
  | { kind: 'head-is-base'; baseBranch: string }
  | { kind: 'none' }
