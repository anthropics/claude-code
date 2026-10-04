import { chargedWidth } from '../charged-width'

/**
 * A sanitized text with spaces after it up to a width in cells, counted by
 * chargedWidth; unchanged when it is that wide already.
 *
 * @param text the text
 * @param cells the width to reach
 * @returns the padded text
 */
export const padEnd = (text: string, cells: number) =>
  `${text}${' '.repeat(Math.max(0, cells - chargedWidth(text)))}`
