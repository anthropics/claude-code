import type Types from '../../../types'

/**
 * Breaks a tie of size between two series by their names.
 *
 * @param left a series
 * @param right the series it is compared with
 * @returns -1 where the earlier name is that of the former, and 1 otherwise
 */
export const orderByName = (
  left: Types.SizedSeries,
  right: Types.SizedSeries,
): number => (left.name < right.name ? -1 : 1)
