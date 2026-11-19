import { TRUNCATION_LINES } from './truncation-lines'

/**
 * A whole line: a cell is only a part of its line, so none can spell one.
 */
export const TRUNCATION_LINE = new RegExp(
  `^(?:${TRUNCATION_LINES.map(line => line.source).join('|')})$`,
  'im',
)
