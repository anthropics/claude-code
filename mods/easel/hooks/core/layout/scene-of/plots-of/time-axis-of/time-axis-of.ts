import type Shapes from '../../../../shapes'
import Texts from '../../../../texts'
import Limits from '../../../limits'
import { textShapesOf } from '../../../text-shapes-of'
import type Types from '../../../types'
import { axisOf } from './axis-of'
import { tickLabelsOf } from './tick-labels-of'
import { ticksOf } from './ticks-of'

/**
 * Draws the line under the plots, its ticks and their labels, then the labels
 * of the marks.
 *
 * A column is named by its start: the first at the tick's time or later. A
 * label shares the row of the label before it where there is room.
 *
 * @param options the room, the time on the axis, the area above, the marks
 * @returns the axis and its labels, and the first row under them
 */
export function timeAxisOf(options: Types.TimeAxisToLay): Types.Laid {
  const ticks = ticksOf(options)
  const tickRow = options.room.rows + 1
  const flagShapes: Shapes.Shape[] = []
  let rows = tickRow + 1
  let freeFrom: number | undefined

  for (const flag of options.flags.filter(flag => flag.text !== '')) {
    const flagWidth = Texts.widthOf(flag.text)
    const start = Math.floor(Math.min(flag.x, options.room.columns - flagWidth))
    const isOnNewRow = freeFrom === undefined || start < freeFrom

    if (isOnNewRow) {
      rows += 1
    }

    flagShapes.push(
      ...textShapesOf({
        at: { x: start, y: rows - 1 },
        text: flag.text,
        ink: 'words',
      }),
    )
    freeFrom = start + flagWidth + Limits.WORD_GAP
  }

  return {
    shapes: [
      ...axisOf(options, ticks),
      ...tickLabelsOf(ticks, options.area, tickRow),
      ...flagShapes,
    ],
    rows,
  }
}
