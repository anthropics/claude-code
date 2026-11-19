import Lists from '../../lists'
import Texts from '../../texts'
import type Types from '../types'

/**
 * Counts the gaps in what is drawn.
 *
 * @param drawnSeries the series that are drawn
 * @returns one note, or none where no sample is missing
 */
export function missingSampleNotes(drawnSeries: Types.SizedSeries[]): string[] {
  const missingCount = Lists.sumOf(
    drawnSeries.map(series => series.samples.length - series.values.length),
  )
  const hasMissingSamples = missingCount > 0

  return hasMissingSamples
    ? [
        `${Texts.counted(missingCount, 'missing sample')}, left blank ` +
          `where the gap is wide enough to see`,
      ]
    : []
}
