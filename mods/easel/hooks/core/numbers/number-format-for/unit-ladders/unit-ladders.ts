import Limits from '../../limits'
import type Types from '../../types'

/**
 * The units that bring multiples of their own: time, bytes and percent.
 *
 * `SUFFIX_SIZES` is the table for reading, with more spellings.
 */
export const UNIT_LADDERS: readonly Types.UnitLadder[] = [
  {
    ns: Limits.NANOSECOND,
    µs: Limits.MICROSECOND,
    ms: Limits.MILLISECOND,
    s: 1,
    min: Limits.MINUTE,
    h: Limits.HOUR,
    d: Limits.DAY,
  },
  {
    B: 1,
    kB: Limits.THOUSAND,
    MB: Limits.MILLION,
    GB: Limits.BILLION,
    TB: Limits.TRILLION,
    PB: Limits.QUADRILLION,
  },
  { '%': 1 },
]
