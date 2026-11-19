import type Charting from '../../charting'
import type { StatColumn } from './stat-column'

/**
 * Where the key, the name, the lane and the stats of every row stand.
 */
export type Legend = {
  wantsLane: boolean

  /**
   * With the blank after the key. It is 0 where no row has a key.
   */
  keyWidth: number

  shownNames: Map<Charting.LegendRow, string>
  laneLeft: number
  laneWidth: number
  statsLeft: number
  statColumns: StatColumn[]
}
