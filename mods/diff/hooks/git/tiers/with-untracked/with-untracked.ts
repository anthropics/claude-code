import Limits from '../../../limits'
import Probes from '../../probes'
import type Types from '../../types'
import { isPastDetails } from '../is-past-details'
import { mergedResultOf } from './merged-result-of'
import { mergedWithUntracked } from './merged-with-untracked'

/**
 * A tier's rows with the untracked files merged after them
 * (mergedWithUntracked).
 *
 * Past MAX_FILES_FOR_DETAILS nothing is listed; a listing git withheld
 * leaves the tracked rows as they are and says so, as the built-in degrades.
 *
 * @param context the fetch
 * @param result the tier's tracked rows and totals
 * @param scope which untracked files count
 * @returns the merged rows and totals, and whether the listing was withheld
 */
export async function withUntracked(
  context: Types.FetchContext,
  result: Types.NumstatResult,
  scope: Types.UntrackedScope,
): Promise<Types.MergedResult> {
  return isPastDetails(result)
    ? mergedResultOf(result, { isUntrackedWithheld: false })
    : mergedWithUntracked(
        result,
        await Probes.untrackedFiles(context, {
          slots: Limits.MAX_FILES - result.files.length,
          scope,
        }),
      )
}
