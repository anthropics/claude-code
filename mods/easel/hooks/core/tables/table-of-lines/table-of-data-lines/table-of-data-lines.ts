import type Casting from '../../../casting'
import Words from '../../words'

/**
 * A table with no header: all of it is rows, under numbered names.
 *
 * @param lines the cells of each line, the first one data as well
 * @param source the name a table with a header would carry as its source
 * @returns the table, which states that its names are made up
 */
export const tableOfDataLines = (
  lines: string[][],
  source: string,
): Casting.Table => ({
  source: `${source}${Words.NO_HEADER}`,
  hasMadeUpNames: true,
  isCut: false,
  columns: [...(lines[0] ?? []).keys()].map(
    columnIndex => `column ${columnIndex + 1}`,
  ),
  rows: lines,
})
