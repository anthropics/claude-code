/**
 * Walks level by level and stops at the first level past the limit, so a value
 * nested ten thousand deep costs no more than its first levels.
 *
 * @param value a parsed JSON value, which is level 0
 * @param limit the deepest level that may hold anything
 * @returns whether a list, a record or a leaf lies deeper
 */
export function isDeeperThan(value: unknown, limit: number): boolean {
  let level: unknown[] = [value]

  for (let depth = 0; depth <= limit; depth += 1) {
    level = level.flatMap(node =>
      typeof node === 'object' && node !== null ? Object.values(node) : [],
    )
  }

  return level.length > 0
}
