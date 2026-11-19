import type Numbers from '../../../numbers'
import type { PlotRow } from '../plot-row'

/**
 * The series that share one value axis.
 *
 * `stretches` holds the samples of one, split at its gaps, in positions, not
 * cells: x runs from 0 to 1 along the time axis, y from 0 to 1 up the value
 * axis. The y of a stacked column is its top.
 */
export type Plot = {
  ticks: Numbers.Tick[]
  rows: PlotRow[]
}
