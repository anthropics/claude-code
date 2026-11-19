import Patterns from '../../../../patterns'

/**
 * A rule in one stroke covers every position, so it says nothing of columns.
 *
 * @param line a line of a paragraph
 * @returns whether it is neither empty nor such a rule
 */
export const isContent = (line: string): boolean =>
  line !== '' &&
  (!Patterns.SEPARATOR_LINE.test(line) || line.trim().includes(' '))
