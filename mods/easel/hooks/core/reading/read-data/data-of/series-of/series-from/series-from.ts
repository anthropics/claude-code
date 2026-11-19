import Calendar from '../../../../../calendar'
import Lists from '../../../../../lists'
import type Types from '../../../../types'
import { seriesNameOf } from '../series-name-of'
import { sortedTimesOf } from '../sorted-times-of'
import { isKeptToWeekdays } from './is-kept-to-weekdays'
import { sampleIn } from './sample-in'

/**
 * One series of the chart: the rows that share their labels and their column,
 * with a sample at each period of the step that its own times keep.
 *
 * @param group the readings of one series, which is never empty
 * @param options the table as read, with how to name and combine its rows
 * @param isWeekdaysOnly whether all the series together skip weekends
 * @returns the series, named, in the unit of its column
 */
export function seriesFrom(
  group: Types.CellReading[],
  options: Types.SeriesOptions,
  isWeekdaysOnly: boolean,
): Types.Series {
  const ownTimes = sortedTimesOf(group)
  const measure = group[0]?.column ?? ''

  return {
    unit: options.reading.units.get(measure)?.[0] ?? '',
    name: seriesNameOf(group, options),
    measure,
    samples: (
      Calendar.sampleGridOf(
        ownTimes,
        options,
        isKeptToWeekdays(isWeekdaysOnly, ownTimes, options.zone),
      )?.periodStarts ?? ownTimes
    ).map(
      sampleIn(
        Lists.groupBy(group, reading => reading.ms),
        options.combine,
      ),
    ),
  }
}
