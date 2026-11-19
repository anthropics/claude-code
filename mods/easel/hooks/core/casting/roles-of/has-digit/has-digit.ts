import type Cells from '../../../cells'

/**
 * A digit may be a number in a spelling that is not read: `1.000,50`.
 *
 * @param cell the cell to look into
 * @returns whether its text holds a digit
 */
export const hasDigit = (cell: Cells.Cell): boolean => /\d/.test(String(cell))
