import type Easel from '../../../core/easel'

/**
 * An automatic chart as it was drawn when its call answered.
 */
export type ReadChart = {
  /**
   * The id of the call.
   */
  id: string

  /**
   * What its tool answered, before a later hook saw it.
   */
  text: string

  /**
   * What was drawn of that text.
   */
  chart: Easel.DrawnChart
}
