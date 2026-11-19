import Limits from '../limits'

/**
 * A measure from one row to another, written to one decimal for an
 * attribute.
 *
 * @param rows the measure, in cells
 * @returns the same in pixels
 */
export const pixelsDown = (rows: number): string =>
  (rows * Limits.CELL_HEIGHT).toFixed(1)
