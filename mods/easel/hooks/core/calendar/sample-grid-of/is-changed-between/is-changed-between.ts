import type Types from '../../types'

/**
 * Asks of a unit whether two readings of the clock differ in its field.
 *
 * @param before what the clock shows at the earlier instant
 * @param after what the clock shows at the later instant
 * @returns a test of one unit against the two readings
 */
export const isChangedBetween =
  (before: Types.CalendarFields, after: Types.CalendarFields) =>
  (unit: Types.Step['unit']): boolean =>
    before[unit.fieldIndex] !== after[unit.fieldIndex]
