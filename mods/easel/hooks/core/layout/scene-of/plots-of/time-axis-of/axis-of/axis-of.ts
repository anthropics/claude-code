import type Calendar from '../../../../../calendar'
import type Shapes from '../../../../../shapes'
import { textShapesOf } from '../../../../text-shapes-of'
import type Types from '../../../../types'
import { axisLineOf } from './axis-line-of'

/**
 * Draws the line under the plots, from its corner at the left, with a mark
 * for each tick.
 *
 * @param toLay the room above the line and the plots it runs under
 * @param ticks what the line marks
 * @returns the line as text shapes
 */
export const axisOf = (
  toLay: Types.TimeAxisToLay,
  ticks: Calendar.TimeTick[],
): Shapes.Shape[] =>
  textShapesOf({
    at: { x: toLay.area.left - 1, y: toLay.room.rows },
    text: `└${axisLineOf(ticks, toLay.area)}`,
    ink: 'quiet',
  })
