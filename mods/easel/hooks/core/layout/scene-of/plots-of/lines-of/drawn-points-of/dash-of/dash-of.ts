import type Shapes from '../../../../../../shapes'
import Limits from '../../../../../limits'
import type Types from '../../../../../types'

/**
 * A lone sample as a dash, half a cell to each side, kept inside the plots.
 *
 * @param sample the place of the sample, in cells
 * @param area where the plots stand
 * @returns the two ends of the dash
 */
export const dashOf = (
  sample: Shapes.Point,
  area: Types.PlotArea,
): Shapes.Point[] =>
  [sample.x - Limits.HALF_CELL, sample.x + Limits.HALF_CELL].map(dashEnd => ({
    x: Math.max(
      area.left,
      Math.min(dashEnd, area.left + area.width - Limits.EDGE_INSET),
    ),
    y: sample.y,
  }))
