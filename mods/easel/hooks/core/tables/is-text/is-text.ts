import Cells from '../../cells'

/**
 * Neither a number nor a time can be read from it.
 *
 * @param cell a cell as written
 * @returns whether it reads as nothing but a text
 */
export const isText = (cell: string): boolean =>
  Cells.readNumber(cell).kind === 'unread' &&
  Cells.readTime(cell).kind === 'unread'
