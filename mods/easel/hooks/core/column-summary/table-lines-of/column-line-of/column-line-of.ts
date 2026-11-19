import type Casting from '../../../casting'
import { contentsOf } from './contents-of'
import { emptyTextOf } from './empty-text-of'

/**
 * One line of the summary: a heading, then its cells counted by kind.
 *
 * @param column the classified cells under one heading
 * @param listColumns the headings whose cells are lists
 * @returns the line
 */
export const columnLineOf = (
  column: Casting.Column,
  listColumns: string[] = [],
): string =>
  `${column.name}: ` +
  (contentsOf(column).join(', ') ||
    emptyTextOf(listColumns.includes(column.name)))
