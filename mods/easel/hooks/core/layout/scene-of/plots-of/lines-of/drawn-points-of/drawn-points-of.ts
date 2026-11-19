import type Shapes from '../../../../../shapes'
import type Types from '../../../../types'
import { dashOf } from './dash-of'
import { extremesPerHalfCell } from './extremes-per-half-cell'

/**
 * The places that the line of one stretch passes through.
 *
 * A sample with no neighbour is a dash: a dot would be lost on a screen.
 *
 * @param stretch the samples of the stretch, in cells
 * @param area where the plots stand
 * @returns the points of the line
 */
export const drawnPointsOf = (
  stretch: Types.Stretch,
  area: Types.PlotArea,
): Shapes.Point[] =>
  stretch.length > 1 ? extremesPerHalfCell(stretch) : dashOf(stretch[0], area)
