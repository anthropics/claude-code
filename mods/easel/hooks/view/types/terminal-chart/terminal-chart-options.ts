import type { Elements } from 'claude-code'

import type Easel from '../../../core/easel'

/**
 * What the chart of a terminal is made from.
 */
export type TerminalChartOptions = {
  /**
   * What the terminal draws with.
   */
  elements: Elements['terminal']

  /**
   * What was drawn, read for its rows and its words for the model.
   */
  chart: Easel.DrawnChart

  /**
   * The width of the terminal in cells.
   */
  columns: number

  /**
   * Whether to return the plain words with no gutter.
   */
  isScreenReader: boolean

  /**
   * How many calls an auto chart is the newest of; undefined for one that the
   * model asked for.
   */
  autoCallCount: number | undefined
}
