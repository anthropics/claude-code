/**
 * `1 file`, `2 files`: the count, a space, and the noun with an `s` unless
 * the count is one.
 *
 * @param count how many
 * @param noun the singular noun
 * @returns the phrase
 */
export const plural = (count: number, noun: string) =>
  count === 1 ? `1 ${noun}` : `${count} ${noun}s`
