import type Types from '../../../types'
import { msOf } from './ms-of'

/**
 * All cells of a time axis are times, so a cell that is no time differs too.
 *
 * @param numberColumn the column of numbers to compare
 * @param timeColumn the column of the time axis
 * @returns whether some row holds another instant than its time
 */
export const isDifferentInTime = (
  numberColumn: Types.Column,
  timeColumn: Types.Column,
): boolean =>
  numberColumn.cells.some(
    (cell, rowIndex) => msOf(cell) !== msOf(timeColumn.cells[rowIndex]),
  )
