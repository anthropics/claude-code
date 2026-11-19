/**
 * How many members pass a test, with no list made of them on the way.
 *
 * @param items the members to look at
 * @param isCounted the test of one member
 * @returns the number of members that pass
 */
export const countOf = <Item>(
  items: readonly Item[],
  isCounted: (item: Item) => boolean,
): number =>
  items.reduce((count, item) => (isCounted(item) ? count + 1 : count), 0)
