import Limits from '../../limits'

/**
 * Tells an axis whose two ends are too close for steps to lie between them.
 *
 * The negated form also takes a range that is not a number for flat.
 *
 * @param low The low end of the axis, in the written multiple.
 * @param high The high end of the axis, in the written multiple.
 * @returns Whether the range between the two ends counts as flat.
 */
export const isFlatRange = (low: number, high: number): boolean =>
  !(high - low > Limits.EPSILON * Math.abs(high))
