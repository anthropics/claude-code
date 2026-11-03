/**
 * What a fetched diff compares: the working tree against its checked-out
 * commit, or against the merge-base with the default branch.
 *
 * `base` names the commit as the pane should (`HEAD`, or a short sha where
 * the backend has no such word); `baseRef` is the ref git was handed.
 */
export type DiffSource =
  | { kind: 'working-tree'; base: string }
  | { kind: 'branch'; baseBranch: string; baseRef: string }
