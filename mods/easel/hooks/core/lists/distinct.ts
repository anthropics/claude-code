/**
 * Every member once, at the place where it first occurs.
 *
 * @param values a list that may repeat itself
 * @returns the list without its repeats
 */
export const distinct = <Value>(values: Value[]): Value[] => [
  ...new Set(values).values(),
]
