import { withUnit } from '../../../with-unit'

/**
 * Gives every cell of one series the same unit, which is read once for
 * the series and not once for each cell.
 *
 * @param unit the short name of what the cells are counted in, or `''`
 * @returns what puts that unit after one cell
 */
export const inUnit =
  (unit: string): ((value: unknown) => unknown) =>
  value =>
    withUnit(value, unit)
