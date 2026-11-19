/**
 * A map from each key to the members that share it, in their order.
 *
 * Counted first and then placed, so that no list is grown here that was got
 * from elsewhere. `Map.groupBy` is newer than ES2023, which a plugin is
 * checked against.
 *
 * @param items what to group
 * @param keyOf the key of one member
 * @returns the groups, in the order in which their keys first occur
 */
export function groupBy<Item, Key>(
  items: Iterable<Item>,
  keyOf: (item: Item) => Key,
): Map<Key, Item[]> {
  const members: Item[] = []
  const keys: Key[] = []

  for (const member of items) {
    members.push(member)
    keys.push(keyOf(member))
  }

  const firstKeys = [...new Set(keys).values()]
  const groupOfKey = new Map(
    firstKeys.map((key, group): [Key, number] => [key, group]),
  )
  const groups = keys.map(key => groupOfKey.get(key) ?? 0)
  const sizes = firstKeys.map(() => 0)

  for (const group of groups) {
    sizes[group] = (sizes[group] ?? 0) + 1
  }

  const starts: number[] = []
  let total = 0

  for (const size of sizes) {
    starts.push(total)
    total += size
  }

  const places = [...starts]
  const placed = [...members]

  for (const [index, member] of members.entries()) {
    const group = groups[index] ?? 0
    const place = places[group] ?? 0
    placed[place] = member
    places[group] = place + 1
  }

  return new Map(
    firstKeys.map((key, group): [Key, Item[]] => {
      const start = starts[group] ?? 0

      return [key, placed.slice(start, start + (sizes[group] ?? 0))]
    }),
  )
}
