import type Types from '../../../types'

/**
 * A step of whole units that goes through the weekend like any other day.
 *
 * @param unit the calendar unit that the step counts in
 * @param count how many of that unit one step is
 * @returns the step
 */
export const plainStepOf = (
  unit: Types.Step['unit'],
  count: number,
): Types.Step => ({ unit, count, skipsWeekends: false })
