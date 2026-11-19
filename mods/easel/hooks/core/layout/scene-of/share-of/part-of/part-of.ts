import type Charting from '../../../../charting'
import Limits from '../../../limits'
import type Types from '../../../types'

/**
 * A slice as a part of the band, with its width and where its middle is.
 *
 * @param row the slice
 * @param width the cells that the part takes
 * @param right where the part ends, from the band's left edge
 * @returns the slice with its place in the band
 */
export const partOf = (
  row: Charting.Slice,
  width: number,
  right: number,
): Charting.Slice & Types.PartPlace => ({
  ...row,
  width,
  middle: right - width / Limits.HALVES,
})
