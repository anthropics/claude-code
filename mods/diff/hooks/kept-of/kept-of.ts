/**
 * The items that are there: nulls dropped, so a part may answer null for
 * "nothing here" and the whole lists what is left.
 *
 * @param items values or nulls
 * @returns the values, in order
 */
export const keptOf = <T>(items: readonly (T | null)[]): T[] =>
  items.filter((item): item is T => item !== null)
