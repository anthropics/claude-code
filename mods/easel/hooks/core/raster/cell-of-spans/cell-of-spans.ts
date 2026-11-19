import Limits from '../limits'
import type Types from '../types'
import Words from '../words'
import { cellOf } from './cell-of'
import { drawnCoversOf } from './drawn-covers-of'

/**
 * A cell has one glyph and two inks: the two parts that cover the most of it.
 *
 * In the cell where the parts end, a thinner part is not drawn, so that no
 * part looks larger than it is.
 *
 * @param spans the parts, in eighths
 * @param start the eighths at which the cell begins
 * @param partialBlocks the glyphs of a cell filled in part, by eighths
 * @returns the cell, or nothing where no part covers enough of it
 */
export function cellOfSpans(
  spans: Types.Span[],
  start: number,
  partialBlocks: readonly string[],
): Types.CanvasCell | undefined {
  const covers = spans
    .map(span => ({
      ink: span.ink,
      size:
        Math.min(span.to, start + Limits.EIGHTHS_PER_CELL) -
        Math.max(span.from, start),
    }))
    .filter(cover => cover.size >= Limits.MIN_COVER)
  const bySize = covers.toSorted((left, right) => right.size - left.size)
  const [largest] = bySize

  if (largest === undefined) {
    return undefined
  }

  const filled = Math.round((spans.at(-1)?.to ?? start) - start)

  if (filled < Limits.EIGHTHS_PER_CELL) {
    const glyph = partialBlocks[filled]

    return glyph ? { glyph, ink: largest.ink } : undefined
  }

  const [first = largest, second] = drawnCoversOf(covers, bySize)
  const glyph =
    partialBlocks[
      Math.round(
        (first.size / (first.size + (second?.size ?? 0))) *
          Limits.EIGHTHS_PER_CELL,
      )
    ]

  return glyph
    ? cellOf(glyph, first.ink, second?.ink)
    : { glyph: Words.FULL_BLOCK, ink: largest.ink }
}
