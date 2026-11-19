import type { StatPart } from '../stat-part'

/**
 * Where one stat stands in every row, counted from `Legend.statsLeft`.
 */
export type StatColumn = {
  /**
   * The words before the number, the number, the words after.
   */
  parts: StatPart[]

  /**
   * The cell after the stat.
   */
  end: number
}
