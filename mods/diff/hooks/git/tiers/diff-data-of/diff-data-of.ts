import type Types from '../../types'
import type { DiffBasis } from './diff-basis'

/**
 * A settled fetch: the tier's merged rows and totals over the repository
 * and mode of the fetch, with the tier's basis.
 *
 * @param context the fetch
 * @param result the rows and totals, untracked files merged or withheld
 * @param basis what they compare and read against
 * @returns the data an outcome carries
 */
export const diffDataOf = (
  context: Types.FetchContext,
  result: Types.MergedResult,
  basis: DiffBasis,
): Types.DiffData => ({
  repository: context.repository,
  mode: context.mode,
  stats: result.stats,
  files: result.files,
  source: basis.source,
  baseRef: basis.baseRef,
  isUnborn: basis.isUnborn,
  stalePaths: basis.stalePaths,
  isUntrackedWithheld: result.isUntrackedWithheld,
})
