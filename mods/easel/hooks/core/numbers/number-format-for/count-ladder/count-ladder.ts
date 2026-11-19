import Limits from '../../limits'
import type Types from '../../types'

/**
 * No `k`: 10,400 is written out. A billion is `G`: `B` would read as bytes.
 */
export const COUNT_LADDER: Types.UnitLadder = {
  '': 1,
  M: Limits.MILLION,
  G: Limits.BILLION,
  T: Limits.TRILLION,
}
