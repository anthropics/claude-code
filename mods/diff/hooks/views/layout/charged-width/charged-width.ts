import { cellWidth } from '../cell-width'

/**
 * The cells a sanitized text is charged when laid into rows and padded:
 * cellWidth, but a code point drawing in no cell is still charged one.
 *
 * The slicer and the band padding both count by this, so a row never
 * emits more code points than the cells it was given, combining marks or
 * not.
 *
 * @param text a line or segment with no tabs or control characters
 * @returns its charge in cells, at least one per code point
 */
export function chargedWidth(text: string) {
  let charged = 0

  for (const character of text) {
    charged += Math.max(1, cellWidth(character))
  }

  return charged
}
