import Probes from '../probes'
import Tiers from '../tiers'
import type Types from '../types'

/**
 * One fetch of the session's pinned repository, as the built-in panel
 * fetches; every git child names it so paths stay root-relative.
 *
 * Mid-merge, mid-rebase, mid-cherry-pick or mid-revert, or when git cannot
 * answer, it is unavailable and the caller keeps what it had.
 *
 * @param deps the host: pinned git, the repository, the file probes
 * @param mode what to compare against
 * @returns the outcome
 */
export async function fetchDiff(
  deps: Types.GitDeps,
  mode: Types.BaseMode,
): Promise<Types.FetchOutcome> {
  const isBusy = await Probes.isTransient(
    deps.entryKindsOf,
    deps.repository.gitDir,
  )

  if (isBusy) {
    return { kind: 'unavailable' }
  }

  const context = Tiers.fetchContextOf(deps, mode)
  const isBranch = mode === 'branch'

  return isBranch ? Tiers.branchTier(context) : Tiers.workingTreeTier(context)
}
