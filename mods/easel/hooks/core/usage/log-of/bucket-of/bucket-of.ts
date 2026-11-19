/**
 * Rounds down, so that no count over 1 is told exactly.
 *
 * @param count a count or a time, at or above zero
 * @returns the power of two at or below it, or zero below one
 */
export const bucketOf = (count: number): number =>
  count < 1 ? 0 : 2 ** Math.floor(Math.log2(count))
