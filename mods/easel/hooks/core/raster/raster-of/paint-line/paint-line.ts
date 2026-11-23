import type Shapes from '../../../shapes'
import Limits from '../../limits'
import type Types from '../../types'
import { dotBitOf } from './dot-bit-of'
import { paintDots } from './paint-dots'

/**
 * Walks from each sample to the next in steps of one dot, and lights the
 * dot under each step. A cell is costly to make, so it is made when the walk
 * leaves it, not at each dot.
 *
 * @param canvas the cells to paint in
 * @param shape the samples of the line and its ink
 * @returns nothing
 */
export function paintLine(
  canvas: Types.Canvas,
  { points, ink }: Shapes.LineShape,
): void {
  let place = { x: Number.NaN, y: Number.NaN }
  let bits = 0

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
      const isInAnotherCell =
        Math.floor(left) !== place.x || Math.floor(top) !== place.y

      if (isInAnotherCell) {
        paintDots(canvas, place, { ink, bits })
        place = { x: Math.floor(left), y: Math.floor(top) }
        bits = 0
      }

      bits |= dotBitOf(left, top)
    }
  }

  paintDots(canvas, place, { ink, bits })
}
