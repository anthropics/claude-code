import Cells from '../../../../../../../cells'
import Flags from '../../../../../../flags'

/**
 * Whether a call that names the column as y would read numbers in it.
 *
 * A text such as `250m` is a number once a call names its column as y.
 *
 * @param texts the distinct texts of one column
 * @returns whether each of them is a number there
 */
export const isReadAsNumbers = (texts: Cells.Cell[]): boolean =>
  texts.every(
    cell => Cells.readNumber(cell, Flags.IS_NAMED_AS_Y).kind === 'number',
  )
