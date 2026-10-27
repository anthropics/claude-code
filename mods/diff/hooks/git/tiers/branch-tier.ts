import Probes from '../probes'
import type Types from '../types'
import { branchSourceOf } from './branch-source-of'
import { diffDataOf } from './diff-data-of'
import { unbornTier } from './unborn-tier'
import { withUntracked } from './with-untracked'

/**
 * Branch mode: everything that differs from the default branch, the merge
 * base against the working tree, pinned, as the built-in panel diffs it.
 *
 * With HEAD at the base the diff is HEAD's under the vs-<default> label;
 * with no base it is labelled a plain working-tree diff; a base that may
 * resolve next time answers unavailable so the last branch view stays.
 *
 * @param context the fetch
 * @returns the outcome
 */
export async function branchTier(
  context: Types.FetchContext,
): Promise<Types.FetchOutcome> {
  const { deps, run } = context
  const base = await Probes.branchBaseOf(run)
  deps.onBranchBase(base)

  if (base.kind === 'error') {
    return unbornTier(context)
  }

  const source = branchSourceOf(base)
  const baseRef = source.kind === 'branch' ? source.baseRef : 'HEAD'
  const diff = await Probes.statsOf(context, baseRef)
  const isTransientFailure = diff === null && base.kind === 'merge-base'

  if (isTransientFailure) {
    return { kind: 'unavailable' }
  }

  if (!diff) {
    return unbornTier(context)
  }

  return {
    kind: 'data',
    data: diffDataOf(
      context,
      await withUntracked(context, diff, 'session-only'),
      {
        source,
        baseRef,
        isUnborn: false,
        stalePaths: [],
      },
    ),
  }
}
