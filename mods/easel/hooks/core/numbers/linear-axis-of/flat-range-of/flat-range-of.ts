import Limits from '../../limits'

/**
 * Gives the range an axis shows when all its values are nearly one value: a
 * fraction of that value, or 1 around zero.
 *
 * @param high The greatest value, in multiples.
 * @returns The range to divide into steps.
 */
export const flatRangeOf = (high: number): number =>
  high === 0 ? 1 : Math.abs(high) / Limits.FLAT_LINE_RANGE_DIVISOR
