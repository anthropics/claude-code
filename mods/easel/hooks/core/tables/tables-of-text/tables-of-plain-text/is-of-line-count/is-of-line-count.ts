import type Types from '../../../types'

/**
 * A test for the readings whose tables cover a given count of lines.
 *
 * @param lineCount the count of lines to look for
 * @returns the test of one reading: whether it covers exactly that many
 */
export const isOfLineCount =
  (lineCount: number) =>
  (reading: Types.Reading): boolean =>
    reading.lineCount === lineCount
