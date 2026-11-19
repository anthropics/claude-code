import Limits from '../../../limits'
import Records from '../../../records'

/**
 * A cell holds a few columns and rows of dots; a place inside the cell
 * lights the dot that it falls in.
 *
 * @param left how far across the canvas the place is, in cells
 * @param top how far down the canvas the place is, in cells
 * @returns the braille bit of that dot within its cell
 */
export const dotBitOf = (left: number, top: number): number =>
  Records.DOT_BITS[
    Math.floor((left - Math.floor(left)) * Limits.DOT_COLUMNS) *
      Limits.DOT_ROWS +
      Math.floor((top - Math.floor(top)) * Limits.DOT_ROWS)
  ] ?? 0
