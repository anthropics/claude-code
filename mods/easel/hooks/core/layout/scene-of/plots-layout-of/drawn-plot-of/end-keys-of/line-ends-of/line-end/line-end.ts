import type Types from '../../../../../../types'

/**
 * A key and its ink, placed where the line that carries them ends.
 *
 * @param series the series that the line draws
 * @param row the row of the plot where the line ends
 * @returns the end of the line
 */
export const lineEnd = (
  series: Types.PlotRows[number],
  row: number,
): Types.LineEnd => ({ key: series.key, ink: series.ink, row })
