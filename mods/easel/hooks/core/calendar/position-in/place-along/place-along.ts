import Limits from '../../limits'
import type Types from '../../types'

/**
 * Places an instant by its share of the time between the two ends.
 *
 * @param span the ends of the axis
 * @returns a function from an instant to its place, the middle for no length
 */
export const placeAlong =
  (span: Types.TimeSpan) =>
  (ms: number): number => {
    const hasLength = span.untilMs > span.fromMs

    return hasLength
      ? (ms - span.fromMs) / (span.untilMs - span.fromMs)
      : Limits.MIDDLE_OF_SPAN
  }
