import { KEPT_FORMATS } from './kept-formats'

/**
 * Writes the size of a number with thousands separators; zero is written
 * whole. To build a format costs more than to use it, so each is kept.
 *
 * @param rounded The number, at the precision it is shown in.
 * @param decimals How many fraction digits every number but zero shows.
 * @returns The digits, without a sign.
 */
export function digitsOf(rounded: number, decimals: number): string {
  const minimumFractionDigits = rounded === 0 ? 0 : decimals
  const format =
    KEPT_FORMATS.get(minimumFractionDigits) ??
    new Intl.NumberFormat('en-US', { minimumFractionDigits })
  KEPT_FORMATS.set(minimumFractionDigits, format)

  return format.format(Math.abs(rounded))
}
