import Limits from '../limits'
import type Types from '../types'
import { unread } from '../unread'
import { numberOf } from './number-of'

/**
 * Refuses a number too large or too small to sum safely.
 *
 * The test of the upper bound is written as a negation so that NaN is refused
 * too.
 *
 * @param value the number, with any multiple worked in
 * @param unit the base unit it is counted in
 * @returns the number read, or why it is not
 */
export function checkedMagnitude(
  value: number,
  unit: string | null,
): Types.NumberRead {
  const size = Math.abs(value)
  const isTooLarge = !(size <= Limits.MAX_MAGNITUDE)

  if (isTooLarge) {
    return unread('too large')
  }

  const isTooSmall = size > 0 && size < Limits.MIN_MAGNITUDE

  return isTooSmall ? unread('too small') : numberOf(value, unit)
}
