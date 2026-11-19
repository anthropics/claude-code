import Calendar from '../../../../calendar'
import type Reading from '../../../../reading'
import type Types from '../../../types'

/**
 * Makes the placing of one moment the call points out on a time axis.
 *
 * @param timeline the time axis the moments are placed on
 * @returns a function from a moment that was read to its mark
 */
export function markIn(
  timeline: Reading.Timeline,
): (moment: Reading.Data['marks'][number]) => Types.Mark {
  const positionOf = Calendar.positionIn(timeline)

  return moment => ({
    position: positionOf(moment.ms),
    when: Calendar.timeLabelIn(timeline, moment.ms),
    label: moment.label,
  })
}
