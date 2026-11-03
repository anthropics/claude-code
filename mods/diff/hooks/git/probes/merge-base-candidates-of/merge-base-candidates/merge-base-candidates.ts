/**
 * What the two merge-base calls yielded: the object names printed, in
 * call order, and whether either ran to a no-common-ancestor exit.
 */
export type MergeBaseCandidates = {
  candidates: readonly string[]
  hasNoCommonAncestor: boolean
}
