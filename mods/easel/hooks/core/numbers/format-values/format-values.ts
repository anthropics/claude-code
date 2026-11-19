import { formatAll } from '../format-all'
import { formatAlone } from '../format-alone'
import Limits from '../limits'
import { numberFormatFor } from '../number-format-for'
import type Types from '../types'

/**
 * Writes numbers for people. All share the multiple of the largest.
 *
 * Where that leaves a value too small to read, each gets a format of its own
 * instead: `2min` and `7ms`.
 *
 * @param unit The unit the numbers are in.
 * @param values The numbers to write, in base units.
 * @param sharing What the format is shared with, and the least to write.
 * @returns One written number for each of the given ones, in their order.
 */
export function formatValues(
  unit: string,
  values: number[],
  sharing: Types.FormatSharing = {},
): string[] {
  const { peers = values, minWritten = 0 } = sharing
  const format = numberFormatFor(unit, peers)
  const isTooSmallToRead =
    Math.min(
      ...[...values, ...peers].filter(value => value !== 0).map(Math.abs),
    ) *
      format.multiplesPerUnit <
    Math.max(
      minWritten,
      Limits.MIN_UNITS_OF_LAST_DECIMAL / Limits.DECIMAL_BASE ** format.decimals,
    )

  return isTooSmallToRead
    ? values.map(value => formatAlone(value, unit))
    : formatAll(format, values)
}
