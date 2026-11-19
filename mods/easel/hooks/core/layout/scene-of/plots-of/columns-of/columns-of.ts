import type Shapes from '../../../../shapes'
import type Types from '../../../types'
import { columnStandingOn } from './column-standing-on'
import { periodTopsOf } from './period-tops-of'

/**
 * Draws each period as one column of its series' parts, stacked from the
 * foot of the plot up.
 *
 * Every sample is placed before the foot is, and the columns keep the order
 * in which their periods first appear.
 *
 * @param series the series, their area, the way to a sample's place
 * @returns the shapes, in the order to paint them
 */
export const columnsOf = (series: Types.SeriesToLay): Shapes.Shape[] =>
  [...periodTopsOf(series)].map(
    columnStandingOn(series.toCells({ x: 0, y: 0 }).y, series.area),
  )
