/**
 * How many items of a list pass a test, without the intermediate array a
 * filter would build.
 *
 * @param items the list
 * @param passes the test
 * @returns the number of passing items
 */
export const countOf = <T>(items: readonly T[], passes: (item: T) => boolean) =>
  items.reduce((total, item) => total + (passes(item) ? 1 : 0), 0)
