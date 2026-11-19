import Limits from '../../limits'
import type Types from '../../types'

/**
 * The step of whole units that comes nearest to a gap between samples.
 *
 * Only a step of one day leaves weekends out.
 *
 * @param unit the unit the step is counted in
 * @param gapMs the time from one sample to the next
 * @param onWeekdays whether the samples keep to weekdays
 * @returns the step, of at least one unit
 */
export function stepOfGap(
  unit: Types.Step['unit'],
  gapMs: number,
  onWeekdays: boolean,
): Types.Step {
  const count = Math.max(1, Math.round(gapMs / unit.typicalMs))
  const skipsWeekends =
    onWeekdays && unit.fieldIndex === Limits.DAY && count === 1

  return { unit, count, skipsWeekends }
}
