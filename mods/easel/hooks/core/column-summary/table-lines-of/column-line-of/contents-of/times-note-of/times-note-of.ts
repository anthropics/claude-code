import type Cells from '../../../../../cells'
import { isReadAsTimes } from './is-read-as-times'

/**
 * What follows a tally of numbers that a call could read as times.
 *
 * @param numbers the numbers of one column
 * @returns the note, or nothing where they name no instants
 */
export const timesNoteOf = (numbers: Cells.Cell[]): string =>
  isReadAsTimes(numbers) ? ', read as times if named as x' : ''
