import { checkedMagnitude } from '../../checked-magnitude'
import type Types from '../../types'
import { UNIT_SUFFIXES } from '../../unit-suffixes'

/**
 * Scales a value by the size of its unit suffix, into the suffix's base unit.
 *
 * A suffix that is not a known unit is kept as the unit, unscaled.
 *
 * @param value the value as written before the suffix
 * @param suffix the suffix written after the value
 * @returns the scaled number, or why it was not read
 */
export function scaledByUnit(value: number, suffix: string): Types.NumberRead {
  const { unit, size } = UNIT_SUFFIXES.get(suffix) ?? { unit: suffix, size: 1 }

  return checkedMagnitude(value * size, unit)
}
