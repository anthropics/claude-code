import type Types from '../../types'

/**
 * What branch mode's diff compares, given its resolved base: the merge
 * base, HEAD under the default branch's label, or the plain working tree.
 *
 * @param base the resolved base
 * @returns the source the rows are labelled with
 */
export function branchSourceOf(
  base: Types.ResolvedBranchBase,
): Types.DiffSource {
  switch (base.kind) {
    case 'merge-base':
      return {
        kind: 'branch',
        baseBranch: base.baseBranch,
        baseRef: base.mergeBase,
      }
    case 'head-is-base':
      return { kind: 'branch', baseBranch: base.baseBranch, baseRef: 'HEAD' }
    case 'none':
      return { kind: 'working-tree', base: 'HEAD' }
  }
}
