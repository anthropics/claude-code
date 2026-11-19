import type CoreCall from '../../../call'
import type Reading from '../../../reading'
import type { Frame } from '../frame'
import type { SizedSeries } from '../sized-series'

/**
 * What small charts of one row each are drawn from.
 */
export type SparksOptions = {
  topSeries: SizedSeries[]
  frame: Frame
  request: CoreCall.ChartRequest
  data: Reading.Data
}
