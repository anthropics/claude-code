import Limits from '../limits'

/**
 * How many decimals show a number to a count of its leading figures.
 *
 * @param size The number to show, above zero for any decimals at all.
 * @param digits How many of its leading digits must show.
 * @returns The decimals needed, from none up to what `toFixed` accepts.
 */
export function decimalsFor(size: number, digits: number): number {
  const isAboveZero = size > 0

  return isAboveZero
    ? Math.min(
        Math.max(0, digits - 1 - Math.floor(Math.log10(size) + Limits.EPSILON)),
        Limits.MAX_DECIMALS,
      )
    : 0
}
