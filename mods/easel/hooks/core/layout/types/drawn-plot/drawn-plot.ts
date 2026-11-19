import type Charting from '../../../charting'
import type { DrawnScale } from './drawn-scale'

/**
 * A plot with the scale and the height that it is drawn at.
 */
export type DrawnPlot = Charting.Plot & DrawnScale
