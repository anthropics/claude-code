import Patterns from '../patterns'
import Records from '../records'

/**
 * Splits a string into the pieces a reader sees as single characters.
 *
 * @param text the string to split
 * @returns its graphemes, in order
 */
export function graphemesOf(text: string): string[] {
  const isPrintableAscii = Patterns.PRINTABLE_ASCII.test(text)

  return isPrintableAscii
    ? text.split('')
    : Array.from(Records.SEGMENTER.segment(text), part => part.segment)
}
