import type Calendar from '../../../../../calendar'
import type Shapes from '../../../../../shapes'
import { textShapesOf } from '../../../../text-shapes-of'
import type Types from '../../../../types'

/**
 * Writes the label of each tick of the time axis from its own first column.
 *
 * @param ticks what to label
 * @param area the plots above the axis
 * @param row where the labels are written
 * @returns the labels as text shapes
 */
export const tickLabelsOf = (
  ticks: Calendar.TimeTick[],
  area: Types.PlotArea,
  row: number,
): Shapes.Shape[] =>
  ticks.flatMap(tick =>
    textShapesOf({
      at: { x: area.left + tick.start, y: row },
      text: tick.text,
      ink: 'quiet',
    }),
  )
