import { FIRST_WIDE_POINT } from './first-wide-point'
import { WIDE_RANGES } from './wide-ranges'
import { ZERO_WIDTH_RANGES } from './zero-width-ranges'

/**
 * How many terminal cells a sanitized line takes: one per code point, two
 * for a wide one, none for a combining or zero-width one.
 *
 * Everything below FIRST_WIDE_POINT, the common case in a diff, never
 * reaches the tables.
 *
 * @param text a line with no tabs or control characters
 * @returns its width in cells
 */
export function cellWidth(text: string) {
  let width = 0

  for (const character of text) {
    const point = character.codePointAt(0) ?? 0

    const holds = ([low, high]: readonly [number, number]) =>
      point >= low && point <= high

    const isNarrow = point < FIRST_WIDE_POINT
    const isZero = !isNarrow && ZERO_WIDTH_RANGES.some(holds)
    const isWide = !isNarrow && !isZero && WIDE_RANGES.some(holds)
    width += isZero ? 0 : isWide ? 2 : 1
  }

  return width
}
