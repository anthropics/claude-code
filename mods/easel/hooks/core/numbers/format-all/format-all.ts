import Limits from '../limits'
import type Types from '../types'
import { digitsOf } from './digits-of'
import { signOf } from './sign-of'

/**
 * The fewest decimals that write every value exactly, up to the most allowed.
 * More only while rounding gains a digit: 99.999% must not read 100.00%.
 *
 * Money has cents and no tenths: `$1.50`.
 *
 * @param format How the numbers are written.
 * @param values The numbers to write, in base units.
 * @returns One written number for each of the given ones, in their order.
 */
export function formatAll(
  format: Types.NumberFormat,
  values: number[],
): string[] {
  const scaledValues = values.map(value => value * format.multiplesPerUnit)

  const areTooFew = (tried: number): boolean =>
    scaledValues.some(scaled => {
      const exact = Math.abs(scaled)
      const rounded = Number(exact.toFixed(tried))

      return (
        Math.abs(rounded - exact) > Limits.EPSILON * exact &&
        (tried < format.decimals ||
          Math.floor(Math.log10(rounded)) > Math.floor(Math.log10(exact)))
      )
    })

  let decimals = 0

  while (areTooFew(decimals)) {
    decimals++
  }

  const isMoneyInTenths =
    decimals === 1 && format.before !== '' && format.after === ''

  if (isMoneyInTenths) {
    decimals = Limits.CENTS_DECIMALS
  }

  return scaledValues.map(scaled => {
    const rounded = Number(scaled.toFixed(decimals))

    return (
      signOf(rounded) +
      format.before +
      digitsOf(rounded, decimals) +
      (rounded === 0 ? format.afterZero : format.after)
    )
  })
}
