import type { EaselMeta } from './easel-meta'

/**
 * The one block of a chart call's result, as the host stores it.
 */
export type ClockedBlock = {
  /**
   * The kind of block, which the host knows as text.
   */
  type: 'text'

  /**
   * The words that the model reads for the chart.
   */
  text: string

  /**
   * What is kept beside the words, for later redraws.
   */
  _meta: EaselMeta
}
