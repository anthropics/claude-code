import type { Ink } from '../ink'
import type { Point } from '../point'

/**
 * One row of columns side by side, each as tall as its share of the row.
 */
export type StripShape = {
  kind: 'strip'
  at: Point

  /**
   * The height of each column as a share of the row. Null leaves a gap.
   */
  heights: Array<number | null>

  ink: Ink
}
