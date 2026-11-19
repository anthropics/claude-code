import type Types from '../../../../../types'

/**
 * The most rows that one plot may take, by how many plots share the scene.
 */
export const MAX_PLOT_ROWS_BY_COUNT = [
  11, 7, 5,
] as const satisfies Types.OnePerPlotCount
