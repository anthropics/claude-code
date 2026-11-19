import type Charting from '../../../../charting'

/**
 * Counts the stats of the row that has the most.
 *
 * @param rows the rows whose stats are counted
 * @returns how many columns of stats the rows take, 0 where there is no row
 */
export const statCountOf = (rows: Charting.LegendRow[]): number =>
  Math.max(0, ...rows.map(row => row.stats.length))
