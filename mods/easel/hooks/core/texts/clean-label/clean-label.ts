import { graphemesOf } from '../graphemes-of'
import Limits from '../limits'
import Patterns from '../patterns'
import { truncateMiddle } from '../truncate-middle'
import Words from '../words'
import { boundedTo } from './bounded-to'
import { visibleIn } from './visible-in'

/**
 * Makes a string from outside safe to draw as one label of a bounded width.
 *
 * This module holds text: its width in cells, how it is cut, and how outside
 * text is cleaned. Cut in code units first: see `MAX_CODE_UNITS_PER_CELL`.
 *
 * @param raw the string as it came from outside
 * @param maxWidth the most cells the label may take
 * @returns one line without invisible characters, cut in the middle to fit
 */
export function cleanLabel(
  raw: string,
  maxWidth = Limits.MAX_LABEL_WIDTH,
): string {
  const line = boundedTo(raw, maxWidth * Limits.MAX_CODE_UNITS_PER_CELL)
    .trim()
    .replace(Patterns.LATER_LINES, Words.ELLIPSIS)
    .replace(Patterns.BLANK_RUNS, ' ')
  const isPrintableAscii = Patterns.PRINTABLE_ASCII.test(line)

  return truncateMiddle(
    (isPrintableAscii ? line : graphemesOf(line).map(visibleIn).join(''))
      .replace(Patterns.SPACES, ' ')
      .trim(),
    maxWidth,
  )
}
