import Texts from '../../../../../texts'
import Limits from '../../../../limits'
import type Types from '../../../../types'

/**
 * A series is named by the labels its rows share, cut to fit a legend; rows
 * with no label take the name of the chart.
 *
 * @param group the readings of one series
 * @param options the table as read, with the name to fall back on
 * @returns the name to show
 */
export const seriesNameOf = (
  group: Types.CellReading[],
  options: Types.SeriesOptions,
): string =>
  Texts.truncateMiddle(
    group[0]?.groupLabels.join(' ') || options.fallbackName,
    Limits.MAX_NAME_WIDTH,
  )
