/**
 * The places of a list of that many members, from zero up.
 *
 * A length is read as `Array.from` reads one: a fraction is rounded down, and
 * a length below zero or one that is no number gives no place at all.
 *
 * @param length how many members the list has
 * @returns zero, one and so on, up to and without the length
 */
export const indexesBelow = (length: number): number[] => [
  ...Array.from({ length }).keys(),
]
