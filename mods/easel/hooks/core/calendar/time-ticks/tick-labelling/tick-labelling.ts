import Flags from '../../flags'
import type Types from '../../types'

/**
 * The labels of an axis, which leave out what its first instant states.
 *
 * @param span the ends of the axis, for where its calendar is read
 * @param fieldsBefore what the calendar reads where the axis begins
 * @returns how the labels of the ticks are written
 */
export const tickLabelling = (
  span: Types.TimeSpan,
  fieldsBefore: readonly number[],
): Types.Labelling => ({
  zone: span.zone,
  areTicks: Flags.ARE_TICKS,
  fieldsBefore,
})
