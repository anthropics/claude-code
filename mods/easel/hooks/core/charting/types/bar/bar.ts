import type { LegendRow } from '../legend-row'

/**
 * A legend row that is drawn as one bar.
 */
export type Bar = LegendRow & {
  /**
   * A share of the full length: negative where the value is, 0 for a total.
   */
  relativeLength: number
}
