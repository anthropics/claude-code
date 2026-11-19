import Limits from '../limits'

/**
 * Call it before building, wherever the cell count is a product of two
 * counts: a short text can name millions of cells.
 *
 * @param columnCount how many columns would be built
 * @param rowCount how many rows would be built
 * @returns whether that is more than is read
 */
export const isTooLarge = (columnCount: number, rowCount: number): boolean =>
  columnCount > Limits.MAX_COLUMNS ||
  columnCount * rowCount > Limits.MAX_TABLE_CELLS
