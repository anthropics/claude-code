import type Types from '../../types'

/**
 * Asks of a unit whether any instant reads past its start in that field.
 *
 * @param finestIndexes for each instant, the last field that is off its start
 * @returns a test of one unit against all of them
 */
export const isUnitNeededBy =
  (finestIndexes: readonly number[]) =>
  (unit: Types.Step['unit']): boolean =>
    finestIndexes.some(finestIndex => finestIndex >= unit.fieldIndex)
