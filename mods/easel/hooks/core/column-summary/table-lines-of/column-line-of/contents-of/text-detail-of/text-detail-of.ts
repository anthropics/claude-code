import type Cells from '../../../../../cells'
import { numbersNoteOf } from './numbers-note-of'
import { samplesOf } from './samples-of'

/**
 * What follows a tally of texts: a few of them, and what a call could read
 * them as.
 *
 * @param texts the distinct texts of one column
 * @returns the samples in brackets, then the note where there is one
 */
export const textDetailOf = (texts: Cells.Cell[]): string =>
  ` (${samplesOf(texts).join(', ')})${numbersNoteOf(texts)}`
