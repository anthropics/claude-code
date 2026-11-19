import type Cells from '../../../cells'

/**
 * What `readNumber` answers: a number with its unit, or why there is none.
 */
export type NumberReading = ReturnType<typeof Cells.readNumber>
