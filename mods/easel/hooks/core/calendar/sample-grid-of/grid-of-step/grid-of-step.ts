import { stepsAcross } from '../../steps-across'
import type Types from '../../types'
import { isStartIn } from './is-start-in'
import { walkPast } from './walk-past'

/**
 * Lays the periods of a calendar walk under the samples.
 *
 * @param sortedMs the instants of the samples, rising
 * @param step how far the walk goes each time
 * @param span the first and the last sample, and where the calendar is read
 * @returns the grid, or null where a sample is off the walk
 */
export function gridOfStep(
  sortedMs: number[],
  step: Types.Step,
  span: Types.TimeSpan,
): Types.SampleGrid | null {
  const starts = stepsAcross(walkPast(step, span))
  const areAllStarts = sortedMs.every(isStartIn(new Set(starts)))

  if (!areAllStarts) {
    return null
  }

  const periodStarts = starts.filter(ms => ms <= span.untilMs)

  return {
    step,
    periodStarts,
    endMs: starts[periodStarts.length] ?? span.untilMs,
  }
}
