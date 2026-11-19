import Limits from '../../limits'

/**
 * In ms per unit. Epochs in s, ms, µs and ns have these lengths from 1973 to
 * 2286. Any other length is outside those years in both units beside it.
 */
export const EPOCH_SCALE_BY_DIGITS: Readonly<Record<number, number>> = {
  9: Limits.MS_PER_SECOND,
  10: Limits.MS_PER_SECOND,
  12: 1,
  13: 1,
  15: Limits.MS_PER_MICROSECOND,
  16: Limits.MS_PER_MICROSECOND,
  18: Limits.MS_PER_NANOSECOND,
  19: Limits.MS_PER_NANOSECOND,
}
