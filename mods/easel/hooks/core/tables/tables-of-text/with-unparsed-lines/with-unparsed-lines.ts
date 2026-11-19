import type Casting from '../../../casting'

/**
 * States on a table how many lines of its text were not read as JSON.
 *
 * A count the table states itself wins over the one given here.
 *
 * @param unparsedLines the count of lines that did not parse
 * @returns the step from a table to the same table with the count
 */
export const withUnparsedLines =
  (unparsedLines: number) =>
  (table: Casting.Table): Casting.Table => ({ unparsedLines, ...table })
