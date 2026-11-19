import type { LegendRow } from '../legend-row'

/**
 * A legend row that is drawn as a part of a whole.
 */
export type Slice = LegendRow & {
  share: number
}
