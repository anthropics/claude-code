import type { DrawnPlot } from '../drawn-plot'
import type { PlotArea } from '../plot-area'

/**
 * One area for all plots, and each plot at its drawn scale.
 */
export type PlotsLayout = { area: PlotArea; drawnPlots: DrawnPlot[] }
