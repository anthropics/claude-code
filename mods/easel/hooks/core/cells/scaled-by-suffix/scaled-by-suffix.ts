import { checkedMagnitude } from '../checked-magnitude'
import type Types from '../types'
import { CURRENCY_MULTIPLES } from './currency-multiples'
import { scaledByUnit } from './scaled-by-unit'

/**
 * An unknown ending is the unit (`req/s`), or is dropped after a money sign.
 *
 * @param value the number as written, before any multiple
 * @param suffix the letters after the number, '' for none
 * @param currency the money sign before the number, if any
 * @returns the number in its base unit, or why it is not read
 */
export function scaledBySuffix(
  value: number,
  suffix: string,
  currency?: string,
): Types.NumberRead {
  const hasCurrency = currency !== undefined

  return hasCurrency
    ? checkedMagnitude(value * (CURRENCY_MULTIPLES.get(suffix) ?? 1), currency)
    : scaledByUnit(value, suffix)
}
