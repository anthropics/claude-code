import { decimalsFor } from '../../decimals-for'
import type Types from '../../types'

/**
 * How the ticks of an even axis are written: already in the written
 * multiple, with decimals enough to tell one tick from the next.
 *
 * @param format How the values of the axis are written.
 * @param step The distance between two ticks, in the written multiple.
 * @returns What writes every tick of the axis alike.
 */
export const tickFormatOf = (
  format: Types.NumberFormat,
  step: number,
): Types.NumberFormat => ({
  ...format,
  multiplesPerUnit: 1,
  decimals: Math.max(format.decimals, decimalsFor(step, 1)),
})
