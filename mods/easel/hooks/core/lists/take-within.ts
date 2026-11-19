/**
 * The longest head of a list whose sizes together stay within a total.
 *
 * @param items the candidates, in order
 * @param maxTotal the most that the sizes taken may add up to
 * @param sizeOf the size of one candidate
 * @returns the candidates before the first that would pass the total
 */
export function takeWithin<Item>(
  items: Item[],
  maxTotal: number,
  sizeOf: (item: Item) => number,
): Item[] {
  const taken: Item[] = []
  let total = 0

  for (const item of items) {
    total += sizeOf(item)

    if (total > maxTotal) {
      break
    }

    taken.push(item)
  }

  return taken
}
