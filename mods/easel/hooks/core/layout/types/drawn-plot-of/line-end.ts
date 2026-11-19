import type { EndKey } from '../end-key'

/**
 * A key at the end of a line, with the row of the plot that it stands on.
 */
export type LineEnd = {
  /**
   * What marks the series that the line draws.
   */
  key: EndKey['key']

  /**
   * What the line is drawn in.
   */
  ink: EndKey['ink']

  /**
   * Where the line ends, counted in rows down from the top of the plot.
   */
  row: number
}
