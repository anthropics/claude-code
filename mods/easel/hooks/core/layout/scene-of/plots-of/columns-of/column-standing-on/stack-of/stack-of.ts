import type Shapes from '../../../../../../shapes'
import type Types from '../../../../../types'

/**
 * A column of one period: what it is made of, stacked from its foot up.
 *
 * @param at the left side of the column, and the y that it stands on
 * @param area where the plots stand: it holds how wide a column is, in cells
 * @param parts what the column is made of, the lowest first
 * @returns the shape
 */
export const stackOf = (
  at: Shapes.Point,
  area: Types.PlotArea,
  parts: Shapes.StackPart[],
): Shapes.StackShape => ({ kind: 'stack', at, width: area.columnWidth, parts })
