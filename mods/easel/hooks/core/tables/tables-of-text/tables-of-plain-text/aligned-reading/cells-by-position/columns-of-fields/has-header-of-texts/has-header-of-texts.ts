import { isText } from '../../../../../../is-text'

/**
 * A first row that holds a number or a time is a row of data.
 *
 * @param rows the lines of a paragraph that are not rules
 * @returns whether every word of the first line is a text
 */
export const hasHeaderOfTexts = (rows: string[]): boolean =>
  (rows[0] ?? '').trim().split(/ +/).every(isText)
