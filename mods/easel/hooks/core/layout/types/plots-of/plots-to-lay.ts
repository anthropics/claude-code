import type Charting from '../../../charting'
import type { PlotsLayout } from '../plots-layout'
import type { Room } from '../room'

/**
 * What `plotsOf` takes: the room to fill, the chart, where its plots
 * stand and the texts that the header shows.
 */
export type PlotsToLay = {
  room: Room
  chart: Charting.TimeChart
  plotsLayout: PlotsLayout
  headerTexts: string[]
}
