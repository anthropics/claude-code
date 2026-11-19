import { formatAll } from '../format-all'
import { numberFormatFor } from '../number-format-for'

/**
 * Writes one number in the format it would have with no other beside it.
 *
 * @param value The number to write, in base units.
 * @param unit The unit the number is in.
 * @returns The written number.
 */
export const formatAlone = (value: number, unit: string): string =>
  formatAll(numberFormatFor(unit, [value]), [value])[0] ?? ''
