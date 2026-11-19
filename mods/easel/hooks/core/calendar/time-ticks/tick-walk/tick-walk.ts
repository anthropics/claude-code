import type Types from '../../types'
import { tickBoundaryOf } from '../tick-boundary-of'

/**
 * Begins at the last boundary at or before the start of the axis.
 *
 * @param spanStart what the calendar reads where the axis begins
 * @param step how far apart the ticks are
 * @param span the ends of the axis
 * @returns the walk over every instant that may hold a tick
 */
export const tickWalk = (
  spanStart: Types.CalendarFields,
  step: Types.Step,
  span: Types.TimeSpan,
): Types.Walk => ({
  start: [
    ...spanStart.slice(0, step.unit.fieldIndex),
    tickBoundaryOf(spanStart[step.unit.fieldIndex], step),
  ],
  step,
  untilMs: span.untilMs,
  zone: span.zone,
})
