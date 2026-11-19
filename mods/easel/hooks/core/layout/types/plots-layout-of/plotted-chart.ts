import type Charting from '../../../charting'
import type { WithPlots } from './with-plots'

/**
 * Any form that draws its series in plots over a time axis.
 */
export type PlottedChart = Extract<Charting.Chart, WithPlots>
