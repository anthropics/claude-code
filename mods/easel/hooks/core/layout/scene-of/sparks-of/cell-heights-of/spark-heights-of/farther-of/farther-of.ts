/**
 * Picks, of two heights, the one that is farther from a mean: the first
 * where both are as far.
 *
 * @param mean what to measure from
 * @param height the height that is kept where both are as far
 * @param other the height to compare it with
 * @returns one of the two heights
 */
export const fartherOf = (
  mean: number,
  height: number,
  other: number,
): number =>
  Math.abs(height - mean) >= Math.abs(other - mean) ? height : other
