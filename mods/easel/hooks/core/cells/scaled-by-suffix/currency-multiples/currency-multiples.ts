import Limits from '../../limits'

/**
 * Here `B` is a billion, not bytes: `$1.2B`.
 */
export const CURRENCY_MULTIPLES: ReadonlyMap<string, number> = new Map(
  Object.entries({
    k: Limits.THOUSAND,
    K: Limits.THOUSAND,
    M: Limits.MILLION,
    B: Limits.BILLION,
    T: Limits.TRILLION,
  }),
)
