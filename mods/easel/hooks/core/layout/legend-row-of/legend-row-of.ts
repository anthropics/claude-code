import type Charting from '../../charting'
import { textShapesOf } from '../text-shapes-of'
import type Types from '../types'
import { laidRow } from './laid-row'
import { paddingOf } from './padding-of'
import { partInkOf } from './part-ink-of'

/**
 * Lays a key, a name and every part of the stats in their columns, on one
 * row.
 *
 * A stat's first part starts its column; the others end theirs.
 *
 * @param legend where every part of every row stands
 * @param row the row to show
 * @param top the scene's row to lay it on
 * @returns the texts, the row under them and where the row's lane starts
 */
export function legendRowOf(
  legend: Types.Legend,
  row: Charting.LegendRow,
  top: number,
): Types.LaidLegendRow {
  const shapes = [
    ...textShapesOf({ at: { x: 0, y: top }, text: row.key, ink: row.ink }),
    ...textShapesOf({
      at: { x: legend.keyWidth, y: top },
      text: legend.shownNames.get(row) ?? '',
      ink: legend.wantsLane ? 'words' : 'title',
    }),
  ]

  for (const [statIndex, statColumn] of legend.statColumns.entries()) {
    for (const [partIndex, part] of statColumn.parts.entries()) {
      const text = row.stats[statIndex]?.[partIndex] ?? ''
      shapes.push(
        ...textShapesOf({
          at: {
            x: legend.statsLeft + part.start + paddingOf(part, partIndex, text),
            y: top,
          },
          text,
          ink: partInkOf(legend, row, partIndex),
        }),
      )
    }
  }

  return laidRow(shapes, top, legend.laneLeft)
}
