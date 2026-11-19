import type Shapes from '../../../shapes'
import { cellOfSpans } from '../../cell-of-spans'
import Limits from '../../limits'
import Records from '../../records'
import { spansOf } from '../../spans-of'
import type Types from '../../types'
import { footCellOf } from './foot-cell-of'

/**
 * Where the stack starts inside a cell, that cell shows its upper half, or
 * a thin line if it is low.
 *
 * @param canvas the cells to paint in
 * @param shape the stack, its foot and its parts
 * @returns whether the ink of every part is painted
 */
export function isStackPainted(
  canvas: Types.Canvas,
  { at, width, parts }: Shapes.StackShape,
): boolean {
  const floorRow = Math.ceil(at.y)
  const footEighths = (floorRow - at.y) * Limits.EIGHTHS_PER_CELL
  const spans = spansOf(parts, part => part.height, footEighths)
  const topEighths = spans.at(-1)?.to ?? 0
  const paintedInks = new Set<Shapes.Ink | undefined>()

  for (let start = 0; start < topEighths; start += Limits.EIGHTHS_PER_CELL) {
    const cell = cellOfSpans(spans, start, Records.BOTTOM_BLOCKS)

    if (cell === undefined) {
      continue
    }

    const isFoot = start < footEighths
    const paintedCell = isFoot
      ? footCellOf(cell, topEighths - footEighths)
      : cell
    paintedInks.add(paintedCell.ink).add(paintedCell.background)

    for (let offset = 0; offset < Math.round(width); offset++) {
      canvas.set(
        { x: at.x + offset, y: floorRow - 1 - start / Limits.EIGHTHS_PER_CELL },
        paintedCell,
      )
    }
  }

  return parts.every(part => paintedInks.has(part.ink))
}
