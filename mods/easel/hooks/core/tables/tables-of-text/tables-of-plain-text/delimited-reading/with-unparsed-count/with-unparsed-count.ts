import type Casting from '../../../../../casting'

/**
 * States on a table how many lines of its text lie outside every block.
 *
 * The count given here wins over one the table states itself.
 *
 * @param unparsedLines the count of lines that fit no block
 * @returns the step from a table to the same table with the count
 */
export const withUnparsedCount =
  (unparsedLines: number) =>
  (table: Casting.Table): Casting.Table => ({ ...table, unparsedLines })
