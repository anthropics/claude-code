import type Calendar from '../../../../../calendar'
import Flags from '../../../../flags'
import type Types from '../../../../types'

/**
 * The two ends of a span are labelled in full: nothing stands before them.
 *
 * @param options the zone that the times are told in
 * @returns how the labels of the span are read and stand
 */
export const spanLabelling = (
  options: Types.TimelineOptions,
): Calendar.Labelling => ({
  zone: options.zone,
  areTicks: !Flags.IS_STANDALONE,
  fieldsBefore: [],
})
