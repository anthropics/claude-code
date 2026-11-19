import type Shapes from '../../../shapes'
import type Types from '../../types'

/**
 * A row of the legend keeps the name and the stats of its series, and holds
 * each stretch of it as the points to draw.
 *
 * @param options what one plot is drawn from, which tells key and ink
 * @param pointOf tells where a sample is drawn
 * @returns makes the row of a series from its stretches and its stats
 */
export const plotRowIn =
  (
    options: Types.PlotOptions,
    pointOf: (sampleTop: Types.Top) => Shapes.Point,
  ): ((
    drawn: [Types.SizedSeries, [Types.Top[][], Types.Stat[]]],
  ) => Types.PlotRow) =>
  ([series, [stretches, stats]]) => ({
    ...options.identityOf(series),
    name: series.name,
    stats,
    stretches: stretches.map(stretch => stretch.map(pointOf)),
  })
