import type CoreCall from '../../../call'
import type { Frame } from '../frame'
import type { SizedSeries } from '../sized-series'

/**
 * What a chart of one bar for each series is drawn from.
 */
export type BarsChartOptions = {
  /**
   * The words around the bars.
   */
  frame: Frame

  /**
   * The largest series, and those a ranking leaves out.
   */
  selection: Record<'topSeries' | 'cutSeries', SizedSeries[]>

  /**
   * Every series that was read, in the order of the input.
   */
  allSeries: SizedSeries[]

  /**
   * What the call asked for.
   */
  request: CoreCall.ChartRequest
}
