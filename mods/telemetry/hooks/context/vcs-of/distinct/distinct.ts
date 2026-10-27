/**
 * The list with each value once, first occurrence kept, order kept.
 *
 * @param values the list
 * @returns the distinct values
 */
export function distinct(values: readonly string[]): string[] {
  const seen = new Set<string>()

  return values.filter(value => {
    const isSeen = seen.has(value)

    seen.add(value)

    return !isSeen
  })
}
