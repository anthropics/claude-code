import type Shapes from '../../../shapes'
import Limits from '../../limits'
import Records from '../../records'
import type Types from '../../types'
import Words from '../../words'

/**
 * Lower than its row, so that neighbouring bars read apart.
 *
 * No glyph is both that low and part of a cell wide, so a bar ends on a
 * whole cell. One under a cell is full height instead. A hatched sliver
 * would show no hatching.
 *
 * @param canvas the cells to paint in
 * @param shape the bar, its place and its ink
 * @returns nothing
 */
export function paintBar(
  canvas: Types.Canvas,
  { at, width, ink, isHatched }: Shapes.BarShape,
): void {
  const sliver =
    Records.LEFT_BLOCKS[
      Math.max(1, Math.round(width * Limits.EIGHTHS_PER_CELL))
    ]
  const isSliver = sliver !== undefined && !isHatched

  if (isSliver) {
    canvas.set(at, { glyph: sliver, ink })

    return
  }

  for (let offset = 0; offset < Math.max(1, Math.round(width)); offset++) {
    canvas.set(
      { x: at.x + offset, y: at.y },
      { glyph: isHatched ? Words.HATCHED_BLOCK : Words.BAR_BLOCK, ink },
    )
  }
}
