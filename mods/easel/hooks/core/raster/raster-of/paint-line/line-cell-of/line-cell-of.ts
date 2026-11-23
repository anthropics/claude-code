import Limits from '../../../limits'
import type Types from '../../../types'
import { dotCountOf } from './dot-count-of'
import { hasDotCount } from './has-dot-count'

/**
 * A cell that series share shows the dots of each, since a gap in a line
 * means a missing sample.
 *
 * Its ink is that of the line with the most dots, or of the last painted.
 * The rule of a mark gives way to a series: its dots in that ink would be
 * a spike that is no data.
 *
 * @param cell the cell as it is before the dots are painted
 * @param dots the ink of the line and the bits of its new dots
 * @returns the cell with those dots among the dots of its lines
 */
export function lineCellOf(
  cell: Types.CanvasCell,
  dots: Types.LineBits,
): Types.CanvasCell {
  const before = cell.lines ?? []
  const lines = [
    ...before.filter(line => line.ink !== dots.ink),
    {
      ink: dots.ink,
      bits: (before.find(line => line.ink === dots.ink)?.bits ?? 0) | dots.bits,
    },
  ]
  const seriesLines = lines.filter(line => line.ink !== 'quiet')
  const rivals = seriesLines.length > 0 ? seriesLines : lines

  return {
    glyph: String.fromCodePoint(
      Limits.BRAILLE_BASE + rivals.reduce((bits, line) => bits | line.bits, 0),
    ),
    ink:
      rivals.findLast(
        hasDotCount(Math.max(...rivals.map(line => dotCountOf(line.bits)))),
      )?.ink ?? dots.ink,
    lines,
  }
}
