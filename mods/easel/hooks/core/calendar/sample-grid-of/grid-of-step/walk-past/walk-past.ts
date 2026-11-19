import { calendarFieldsAt } from '../../../calendar-fields-at'
import Limits from '../../../limits'
import type Types from '../../../types'
import { typicalStepMs } from '../../../typical-step-ms'

/**
 * A walk from the first sample to a little past the last one.
 *
 * It goes on past the last sample so that the last period has an end.
 *
 * @param step how far the walk goes each time
 * @param span the first and the last sample, and where the calendar is read
 * @returns where the walk begins, how it goes and where it ends
 */
export const walkPast = (
  step: Types.Step,
  span: Types.TimeSpan,
): Types.Walk => ({
  start: calendarFieldsAt(span.fromMs, span.zone),
  step,
  untilMs: span.untilMs + Limits.PERIODS_WALKED_PAST_LAST * typicalStepMs(step),
  zone: span.zone,
})
