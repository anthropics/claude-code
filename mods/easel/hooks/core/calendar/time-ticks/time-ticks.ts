import { calendarFieldsAt } from '../calendar-fields-at'
import { isWeekend } from '../is-weekend'
import Limits from '../limits'
import { stepsAcross } from '../steps-across'
import type Types from '../types'
import { typicalStepMs } from '../typical-step-ms'
import { STEP_LADDER } from './step-ladder'
import { tickLabelling } from './tick-labelling'
import { tickWalk } from './tick-walk'
import { ticksThatFit } from './ticks-that-fit'

/**
 * The densest ticks whose labels all fit, or the first instant alone.
 *
 * @param span the ends of the axis
 * @param finest the finest step worth a tick
 * @param axis the width of the axis, and where an instant sits on it
 * @returns the ticks, left to right
 */
export function timeTicks(
  span: Types.TimeSpan,
  finest: Types.Step,
  axis: Types.TickAxis,
): Types.TimeTick[] {
  const spanStart = calendarFieldsAt(span.fromMs, span.zone)
  const fittingTicksOf = ticksThatFit(tickLabelling(span, spanStart), axis)

  for (const step of STEP_LADDER) {
    const isTooFine =
      typicalStepMs(step) < typicalStepMs(finest) ||
      (span.untilMs - span.fromMs) / typicalStepMs(step) > axis.columns

    if (isTooFine) {
      continue
    }

    const ticks = fittingTicksOf(
      stepsAcross(tickWalk(spanStart, step, span)).filter(
        ms =>
          ms >= span.fromMs &&
          !(
            finest.skipsWeekends &&
            step.unit.fieldIndex === Limits.DAY &&
            isWeekend(ms, span.zone)
          ),
      ),
      step,
    )
    const hasTicks = ticks.length > 0

    if (hasTicks) {
      return ticks
    }
  }

  return fittingTicksOf([span.fromMs], finest)
}
