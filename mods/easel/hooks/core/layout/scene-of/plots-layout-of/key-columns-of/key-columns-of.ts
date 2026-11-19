import type Charting from '../../../../charting'
import Limits from '../../../limits'

/**
 * The cells kept free at the side for one key, where any series has one.
 *
 * @param plots the plots, whose series may each carry a key
 * @returns the width of a key, or 0 where no series has one
 */
export function keyColumnsOf(plots: Charting.Plot[]): number {
  const hasKeys = plots.some(plot => plot.rows.some(row => row.key))

  return hasKeys ? Limits.KEY_WIDTH : 0
}
