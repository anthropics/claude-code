import Limits from '../../limits'
import type Types from '../../types'

/**
 * The multiples of an amount of money, where a billion is `B`.
 */
export const MONEY_LADDER: Types.UnitLadder = {
  '': 1,
  M: Limits.MILLION,
  B: Limits.BILLION,
  T: Limits.TRILLION,
}
