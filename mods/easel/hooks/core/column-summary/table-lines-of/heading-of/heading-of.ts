import Casting from '../../../casting'
import Texts from '../../../texts'

/**
 * What stands above one table's columns: where it came from and its size.
 *
 * @param table the table that was read
 * @returns the heading line
 */
export const headingOf = (table: Casting.Table): string =>
  `${Casting.shownSourceOf(table)}, ` +
  `${Texts.counted(table.rows.length, 'row')}:`
