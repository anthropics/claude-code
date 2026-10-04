import Limits from '../../../limits'
import type Types from '../../types'

/**
 * Whether a diff has more files than get per-file rows: past
 * MAX_FILES_FOR_DETAILS only its totals are kept.
 *
 * @param result the parsed diff
 * @returns whether rows, hunks and the untracked probe are skipped
 */
export const isPastDetails = (result: Types.NumstatResult) =>
  result.stats.filesCount > Limits.MAX_FILES_FOR_DETAILS
