import type Reading from '../../../reading'
import type { SizedSeries } from '../sized-series'

/**
 * What the stats of the series of one plot are worked out from.
 */
export type StatsOptions = {
  seriesOfPlot: SizedSeries[]
  axisValues: number[]
  timeline: Reading.Timeline
  isSummed: boolean
}
