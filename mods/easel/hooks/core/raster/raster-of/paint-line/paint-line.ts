import type Shapes from '../../../shapes'
import { GRID_CELL } from '../../grid-cell'
import Limits from '../../limits'
import type Types from '../../types'
import Words from '../../words'
import { dotBitOf } from './dot-bit-of'
import { lineCellOf } from './line-cell-of'

/**
 * Walks from each sample to the next in steps of one dot, and lights the
 * dot under each step.
 *
 * A line is painted only in cells that are blank, hold the grid or hold
 * another line.
 *
 * @param canvas the cells to paint in
 * @param shape the samples of the line and its ink
 * @returns nothing
 */
export function paintLine(
  canvas: Types.Canvas,
  { points, ink }: Shapes.LineShape,
): void {
  for (const [index, to] of points.entries()) {
    const start = points[index - 1] ?? to
    const stepCount = Math.ceil(
      Math.max(
        Math.abs(to.x - start.x) * Limits.DOT_COLUMNS,
        Math.abs(to.y - start.y) * Limits.DOT_ROWS,
        1,
      ),
    )

    for (let step = 0; step <= stepCount; step++) {
      const left = start.x + ((to.x - start.x) * step) / stepCount
      const top = start.y + ((to.y - start.y) * step) / stepCount
      const place = { x: Math.floor(left), y: Math.floor(top) }
      const cell = canvas.cellAt(place)
      const isBarred =
        !cell ||
        !(
          cell.glyph === Words.BLANK ||
          cell === GRID_CELL ||
          cell.lines !== undefined
        )

      if (isBarred) {
        continue
      }

      canvas.set(place, lineCellOf(cell, { ink, bits: dotBitOf(left, top) }))
    }
  }
}
