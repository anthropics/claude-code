import type Types from '../../../types'

/**
 * A tier's rows stamped with whether the untracked listing was withheld.
 *
 * @param result the rows and totals, untracked files merged in or not
 * @param mark whether git did not give the listing whole
 * @returns the merged result
 */
export const mergedResultOf = (
  result: Types.NumstatResult,
  mark: Pick<Types.MergedResult, 'isUntrackedWithheld'>,
): Types.MergedResult => ({ ...result, ...mark })
