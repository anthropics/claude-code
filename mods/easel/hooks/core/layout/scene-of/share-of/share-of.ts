import type Charting from '../../../charting'
import Lists from '../../../lists'
import { legendOf } from '../../legend-of'
import { legendRowOf } from '../../legend-row-of'
import Limits from '../../limits'
import { NO_LANE } from '../../no-lane'
import type Types from '../../types'
import { bandOf } from './band-of'
import { keyShapesOf } from './key-shapes-of'
import { partOf } from './part-of'

/**
 * Draws the band of parts, a key under each, then a legend row per slice.
 *
 * The widest part gives up the width that `MIN_PART_WIDTH` adds to others. A
 * key stands under the middle of its part, so that a part is found without
 * colour.
 *
 * @param room the width to fill and the row that the band starts on
 * @param rows the slices, in their order
 * @returns the band, the keys and the legend, and the first row under them
 */
export function shareOf(room: Types.Room, rows: Charting.Slice[]): Types.Laid {
  const visibleWidths = rows.map(row => {
    const isShown = row.share > 0

    return isShown
      ? Math.max(row.share * room.columns, Limits.MIN_PART_WIDTH)
      : 0
  })
  const excessWidth = Lists.sumOf(visibleWidths) - room.columns
  const widestIndex = visibleWidths.indexOf(Math.max(...visibleWidths))
  const parts: Array<Charting.Slice & Types.PartPlace> = []
  let right = 0

  for (const [index, row] of rows.entries()) {
    const width =
      (visibleWidths[index] ?? 0) - (index === widestIndex ? excessWidth : 0)

    if (width > 0) {
      right += width
      parts.push(partOf(row, width, right))
    }
  }

  const keysTop = room.rows + Limits.BAND_ROWS
  const legendTop = keysTop + 1
  const legend = legendOf({
    rows,
    columns: room.columns,
    lane: NO_LANE,
    headerTexts: [],
    left: 0,
  })

  return {
    shapes: [
      bandOf(room.rows, parts),
      ...parts.flatMap(part => keyShapesOf(part, keysTop)),
      ...rows.flatMap(
        (row, index) => legendRowOf(legend, row, legendTop + index).shapes,
      ),
    ],
    rows: legendTop + rows.length,
  }
}
