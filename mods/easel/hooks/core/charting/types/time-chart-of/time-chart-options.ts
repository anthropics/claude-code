import type CoreCall from '../../../call'
import type Reading from '../../../reading'
import type { Frame } from '../frame'
import type { SizedSeries } from '../sized-series'

/**
 * What a chart along a time axis is drawn from.
 */
export type TimeChartOptions = {
  groups: SizedSeries[][]
  frame: Frame
  request: CoreCall.ChartRequest
  data: Reading.Data
}
