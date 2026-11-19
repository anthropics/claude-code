import Limits from '../../limits'
import type Types from '../../types'

/**
 * Days have no boundary of their own, so they count from the first.
 *
 * @param fieldValue what the field reads where the axis begins
 * @param step the unit of the field and how many of it
 * @returns what the field reads at the first tick
 */
export function tickBoundaryOf(fieldValue: number, step: Types.Step): number {
  const isInDays = step.unit.fieldIndex === Limits.DAY

  return isInDays ? fieldValue : fieldValue - (fieldValue % step.count)
}
