import Limits from '../../../../limits'
import { MAX_PLOT_ROWS_BY_COUNT } from './max-plot-rows-by-count'
import { rowsThatFitStep } from './rows-that-fit-step'

/**
 * Fewer rows where more plots share the scene, and never more than a tick's
 * most. A count beyond the list takes the least of it.
 *
 * @param plotCount how many plots share the scene
 * @param stepsShown the steps between ticks that the rows of a plot span
 * @returns the rows of one step, 1 at least
 */
export const rowsPerStepOf = (plotCount: number, stepsShown: number): number =>
  Math.max(
    1,
    Math.min(
      rowsThatFitStep(
        MAX_PLOT_ROWS_BY_COUNT.at(plotCount - 1) ??
          Math.min(...MAX_PLOT_ROWS_BY_COUNT),
        stepsShown,
      ),
      Limits.MAX_ROWS_PER_TICK,
    ),
  )
