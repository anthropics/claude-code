import Patterns from '../../patterns'

/**
 * Strips from one grapheme the characters that draw nothing.
 *
 * @param part one grapheme
 * @returns the grapheme without its invisible characters
 */
export function visibleIn(part: string): string {
  const isPictograph = Patterns.PICTOGRAPH.test(part)

  return part.replace(
    isPictograph ? Patterns.INVISIBLE_IN_EMOJI : Patterns.INVISIBLE,
    '',
  )
}
