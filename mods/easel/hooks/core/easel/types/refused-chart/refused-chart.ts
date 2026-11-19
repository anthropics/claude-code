import type { Usage } from '../../../usage'

/**
 * What the model reads in place of a chart, with the kind of fault it names.
 */
export type RefusedChart = {
  /**
   * The word that tells this answer from a chart and from nothing.
   */
  kind: 'refused'

  /**
   * The sentence that says why no chart is drawn.
   */
  modelText: string

  /**
   * What telemetry is told of the refusal: its code, and no text of the data.
   */
  usage: Usage
}
