import Limits from '../limits'

/**
 * To a binary fraction, so that adding whole cells is exact.
 *
 * Whoever rounds a place that was made once, be it a key, a tick or a
 * painter, finds one cell.
 *
 * @param cells a place or a size, in cells
 * @returns the nearest of those fractions
 */
export const snapped = (cells: number): number =>
  Math.round(cells * Limits.CELL_PARTS) / Limits.CELL_PARTS
