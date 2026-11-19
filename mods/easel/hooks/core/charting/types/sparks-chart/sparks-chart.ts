import type { Frame } from '../frame'
import type { Plot } from '../plot'

/**
 * A chart of one small row for each series.
 */
export type SparksChart = Frame & {
  form: 'sparks'
  rows: Plot['rows']

  /**
   * The median distance between two samples, as a position.
   */
  medianStep: number
}
