import type Types from '../../../types'
import { mergedResultOf } from '../merged-result-of'

/**
 * A tier's tracked rows and totals with a listed set of untracked rows
 * after them, or flagged withheld when the lister gave no whole listing.
 *
 * As the built-in's mergeSessionUntrackedFiles merges them, a path a
 * tracked row already holds keeps that row and counts once.
 *
 * @param result the tier's tracked rows and totals
 * @param untracked the untracked rows, or null when their listing was withheld
 * @returns the merged rows and totals, and whether the listing was withheld
 */
export function mergedWithUntracked(
  result: Types.NumstatResult,
  untracked: readonly Types.FileStat[] | null,
): Types.MergedResult {
  if (!untracked) {
    return mergedResultOf(result, { isUntrackedWithheld: true })
  }

  const tracked = new Set(result.files.map(file => file.path))
  const fresh = untracked.filter(file => !tracked.has(file.path))
  const filesCount = result.stats.filesCount + fresh.length
  const stats = { ...result.stats, filesCount }

  return mergedResultOf(
    { stats, files: [...result.files, ...fresh] },
    { isUntrackedWithheld: false },
  )
}
