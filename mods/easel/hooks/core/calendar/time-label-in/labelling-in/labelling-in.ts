import type { Timeline } from '../../../reading/types/timeline/timeline'
import { calendarFieldsAt } from '../../calendar-fields-at'
import Flags from '../../flags'
import type Types from '../../types'
import { isChangedIn } from './is-changed-in'

/**
 * A label alone, which knows the fields that both ends of the data share.
 *
 * @param timeline the ends that are compared
 * @param ms the instant to label
 * @returns how the one label is written
 */
export function labellingIn(timeline: Timeline, ms: number): Types.Labelling {
  const span = timeline.dataSpan
  const start = calendarFieldsAt(span.fromMs, span.zone)
  const changedIndex = start.findIndex(
    isChangedIn(calendarFieldsAt(span.untilMs, span.zone)),
  )

  return {
    zone: span.zone,
    areTicks: !Flags.IS_STANDALONE,
    fieldsBefore: calendarFieldsAt(ms, span.zone).slice(
      0,
      changedIndex === -1 ? start.length : changedIndex,
    ),
  }
}
