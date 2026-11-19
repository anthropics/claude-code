/**
 * Writes a quantity with the word for its unit: `1 row`, `1,200 rows`.
 *
 * That word must take a plain `s` in the plural.
 *
 * @param count how many there are
 * @param noun the singular word for one of them
 * @returns the quantity, grouped by thousands, then the word in its number
 */
export const counted = (count: number, noun: string): string =>
  `${count.toLocaleString('en-US')} ${count === 1 ? noun : `${noun}s`}`
