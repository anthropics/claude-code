import type { EndKey } from '../../end-key'

/**
 * The scale and the height that a plot is drawn at, and the keys at the
 * ends of its lines.
 */
export type DrawnScale = {
  /**
   * From a position on the value axis to rows below the top of the plot.
   */
  yOf: (position: number) => number

  height: number

  /**
   * By the row of the plot that the keys stand on.
   */
  endKeys: Map<number, EndKey[]>
}
