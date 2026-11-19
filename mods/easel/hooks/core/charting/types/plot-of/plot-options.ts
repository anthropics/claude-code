import type CoreCall from '../../../call'
import type Reading from '../../../reading'
import type { SeriesIdentity } from '../series-identity'
import type { SizedSeries } from '../sized-series'

/**
 * What one plot is drawn from.
 */
export type PlotOptions = {
  seriesOfPlot: SizedSeries[]

  /**
   * Tells the key and the ink of one series.
   */
  identityOf: (series: SizedSeries) => SeriesIdentity

  maxAxisSteps: number
  request: CoreCall.ChartRequest
  data: Reading.Data
}
