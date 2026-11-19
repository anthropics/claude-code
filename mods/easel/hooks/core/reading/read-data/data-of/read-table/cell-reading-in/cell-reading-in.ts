import type Casting from '../../../../../casting'
import type Cells from '../../../../../cells'
import type Types from '../../../../types'

/**
 * One measured cell as a reading, under the labels of the series it is in.
 *
 * Where several measures are read, the name of each ends the labels, so that
 * each is a series of its own.
 *
 * @param time the moment that the whole row is read at
 * @param rowLabels what the row holds where the rows are split
 * @param roles what each part of the table is read as
 * @returns what makes the reading of one measure from its name and number
 */
export const cellReadingIn =
  (time: Cells.TimeFound, rowLabels: string[], roles: Casting.Roles) =>
  (column: string, numeric: Types.NumberReading): Types.CellReading => ({
    ms: time.ms,
    isZoned: time.isZoned,
    column,
    groupLabels: roles.y.length > 1 ? [...rowLabels, column] : rowLabels,
    value: numeric.kind === 'number' ? numeric.value : null,
    unit: numeric.kind === 'number' ? numeric.unit : null,
  })
