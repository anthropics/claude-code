import type Charting from '../../../charting'
import type { Lane } from '../lane'

/**
 * What `legendOf` takes: the rows, the width in cells, the lane they want,
 * the texts that the header shows and the x that their plot starts at.
 */
export type LegendNeeds = {
  rows: Charting.LegendRow[]
  columns: number
  lane: Lane
  headerTexts: string[]
  left: number
}
