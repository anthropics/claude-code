import type Forms from '../../../forms'

/**
 * What a list has that holds one entry for each count of plots that a chart
 * may have.
 */
export type OnePerPlotCount = { length: typeof Forms.MAX_PLOTS }
