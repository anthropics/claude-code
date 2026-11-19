import type Types from '../../types'

/**
 * Shapes a number that was read and is safe to sum.
 *
 * Zero carries no base of its own: it takes that of its column.
 *
 * @param value the number, with any multiple worked in
 * @param unit the base unit it is counted in
 * @returns the number read
 */
export const numberOf = (
  value: number,
  unit: string | null,
): Types.NumberRead => ({
  kind: 'number',
  value,
  unit: value === 0 ? null : unit,
})
