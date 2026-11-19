import Casting from '../../casting'
import { namedTable } from '../named-table'
import { tableOfDataLines } from './table-of-data-lines'

/**
 * A first line that reads as data stays a row, as in `du -sh`.
 *
 * @param lines the cells of each line, the first maybe a header
 * @param source the name the table carries as its source
 * @returns the table, with made-up names where it has no header
 */
export function tableOfLines(lines: string[][], source: string): Casting.Table {
  const table = namedTable(source, lines[0] ?? [], lines.slice(1))
  const isHeaded = Casting.hasHeaderRow(Casting.classifiedColumns(table))

  return isHeaded ? table : tableOfDataLines(lines, source)
}
