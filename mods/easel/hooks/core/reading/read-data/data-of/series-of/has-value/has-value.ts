import type Types from '../../../../types'

/**
 * Whether any reading holds a number: a series of gaps alone is not drawn.
 *
 * @param group the readings of one series
 * @returns true if one of them has a value
 */
export const hasValue = (group: Types.CellReading[]): boolean =>
  group.some(reading => reading.value !== null)
