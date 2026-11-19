/**
 * Writes the size of a number with thousands separators; zero is written
 * whole.
 *
 * @param rounded The number, at the precision it is shown in.
 * @param decimals How many fraction digits every number but zero shows.
 * @returns The digits, without a sign.
 */
export const digitsOf = (rounded: number, decimals: number): string =>
  Math.abs(rounded).toLocaleString('en-US', {
    minimumFractionDigits: rounded === 0 ? 0 : decimals,
  })
