/**
 * Pairs of the members at the same index, as many as the shorter list has.
 *
 * @param left the first of each pair
 * @param right the second of each pair
 * @returns the pairs, in order
 */
export function zip<Left, Right>(
  left: readonly Left[],
  right: readonly Right[],
): Array<[Left, Right]> {
  const pairs: Array<[Left, Right]> = []
  const rightItems = right.values()

  for (const leftItem of left) {
    const next = rightItems.next()

    if (next.done) {
      break
    }

    pairs.push([leftItem, next.value])
  }

  return pairs
}
