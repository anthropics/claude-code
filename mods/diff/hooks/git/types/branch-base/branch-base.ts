import type { ResolvedBranchBase } from '../resolved-branch-base'

/**
 * What branch mode diffs against, as the built-in panel names it: a
 * resolved base, or a failure that may pass on the next fetch.
 */
export type BranchBase =
  | ResolvedBranchBase
  | { kind: 'error'; reason: 'merge_base_failed' | 'head_rev_parse_failed' }
