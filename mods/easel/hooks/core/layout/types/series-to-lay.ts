import type { PlotArea } from './plot-area'
import type { PlotRows } from './plot-rows'
import type { ToCells } from './to-cells'

/**
 * What draws the series of one plot takes: the series,
 * their area and the way from a sample to its place.
 */
export type SeriesToLay = {
  rows: PlotRows
  area: PlotArea
  toCells: ToCells
}
