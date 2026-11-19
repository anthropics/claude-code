import type Shapes from '../../../shapes'
import type { LegendRow } from '../legend-row'

/**
 * A legend row with what is drawn for it.
 */
export type PlotRow = LegendRow & { stretches: Shapes.Point[][] }
