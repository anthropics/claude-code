import type Charting from '../../../charting'
import type { Lane } from '../lane'

/**
 * What holds for a legend whichever of its stats are shown: the rows, their
 * lane, their names and the widths that no stat changes.
 */
export type LegendBasis = {
  /**
   * What the legend shows, one row each.
   */
  rows: Charting.LegendRow[]

  /**
   * What the rows want beside their names.
   */
  lane: Lane

  /**
   * The name of every row, uncut. None where the header shows the name.
   */
  fullNames: string[]

  /**
   * Whether the header shows the name of the only row.
   */
  isNamedInHeader: boolean

  /**
   * The width of the blank that stands in for a name the header shows.
   */
  indent: number

  /**
   * With the blank after the key. It is 0 where no row has a key.
   */
  keyWidth: number

  /**
   * The width that the names, the lane and the stats share.
   */
  widthPastKey: number
}
