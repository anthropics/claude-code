import { decimalsFor } from '../../decimals-for'
import Limits from '../../limits'

/**
 * Makes the count of decimals a group of numbers needs when written in a
 * multiple of their unit: enough for the greatest and for their spread.
 *
 * Small sums of money always show cents.
 *
 * @param largest The greatest size among the numbers, in base units.
 * @param range The greatest of the numbers less the least.
 * @param isMoney Whether the numbers are sums of money.
 * @returns The decimals needed on a multiple of a given size in base units.
 */
export const decimalsOnMultiple =
  (largest: number, range: number, isMoney: boolean) =>
  (multipleSize: number): number =>
    Math.max(
      isMoney && largest < Limits.CENTS_SHOWN_UNDER ? Limits.CENTS_DECIMALS : 0,
      decimalsFor(largest / multipleSize, Limits.DIGITS_OF_LARGEST),
      decimalsFor(range / multipleSize, Limits.DIGITS_OF_RANGE),
    )
