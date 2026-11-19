import { scaledBySuffix } from '../../scaled-by-suffix'
import type Types from '../../types'

/**
 * Turns the matched parts of a number into its value, signed and scaled.
 *
 * @param groups the named groups of the matched number pattern
 * @returns the number read, or why it was not
 */
export function numberInGroups(groups: Types.MatchGroups): Types.NumberRead {
  const { sign, currency, suffix = '' } = groups
  const { integer = '0', fraction = '', exponent = '0' } = groups
  const size = Number(`${integer.replaceAll(',', '')}${fraction}e${exponent}`)

  return scaledBySuffix(
    sign === '' || sign === '+' ? size : -size,
    suffix,
    currency,
  )
}
