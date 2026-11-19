import type Cells from '../../../../../../cells'
import { isReadAsNumbers } from './is-read-as-numbers'

/**
 * What follows the samples of texts that a call could read as numbers.
 *
 * @param texts the distinct texts of one column
 * @returns the note, or nothing where some text is no number
 */
export const numbersNoteOf = (texts: Cells.Cell[]): string =>
  isReadAsNumbers(texts) ? ', read as numbers if named as y' : ''
