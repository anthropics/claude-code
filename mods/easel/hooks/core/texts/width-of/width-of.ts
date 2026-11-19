import { graphemesOf } from '../graphemes-of'
import Limits from '../limits'
import Patterns from '../patterns'

/**
 * Counts the terminal cells a string takes when it is drawn.
 *
 * @param text the string to measure
 * @returns its width in cells
 */
export function widthOf(text: string): number {
  const isPrintableAscii = Patterns.PRINTABLE_ASCII.test(text)

  if (isPrintableAscii) {
    return text.length
  }

  let width = 0

  for (const grapheme of graphemesOf(text)) {
    const isEmoji = Patterns.EMOJI.test(grapheme)

    if (isEmoji) {
      width += Limits.EMOJI_WIDTH
    } else {
      for (const codePoint of grapheme) {
        const isZeroWidth = Patterns.ZERO_WIDTH.test(codePoint)

        if (!isZeroWidth) {
          width += Patterns.WIDE.test(codePoint) ? Limits.WIDE_WIDTH : 1
        }
      }
    }
  }

  return width
}
