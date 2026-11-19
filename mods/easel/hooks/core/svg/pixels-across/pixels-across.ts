import Limits from '../limits'

/**
 * A measure along a row, written to one decimal for an attribute.
 *
 * @param columns the measure, in cells
 * @returns the same in pixels
 */
export const pixelsAcross = (columns: number): string =>
  (columns * Limits.CELL_WIDTH).toFixed(1)
