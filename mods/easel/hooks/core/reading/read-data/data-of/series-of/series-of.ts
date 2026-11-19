import Calendar from '../../../../calendar'
import Lists from '../../../../lists'
import type Types from '../../../types'
import { hasValue } from './has-value'
import { seriesFrom } from './series-from'
import { seriesNameOf } from './series-name-of'
import { sortedTimesOf } from './sorted-times-of'

/**
 * Where times keep an even step, each period they skip gets a null sample, so
 * that the gap shows.
 *
 * Each series keeps its own step. Whether weekends count is settled once, from
 * the times of all the series together. A group is never empty: its readings
 * share their labels and their column.
 *
 * @param options the table as read, with how to name and combine its rows
 * @returns the series to draw, and what the timeline is laid from
 */
export function seriesOf(options: Types.SeriesOptions): Types.DrawnSeries {
  const series: Types.Series[] = []
  const emptyNames: string[] = []
  const groups = Lists.groupBy(options.reading.readings, reading =>
    JSON.stringify(reading.groupLabels),
  )
  const times = sortedTimesOf([...groups.values()].filter(hasValue).flat())
  const isWeekdaysOnly = Calendar.isWeekdaysOnly(times, options.zone)

  for (const group of groups.values()) {
    hasValue(group)
      ? series.push(seriesFrom(group, options, isWeekdaysOnly))
      : emptyNames.push(seriesNameOf(group, options))
  }

  return {
    series,
    emptyNames,
    times,
    grid: Calendar.sampleGridOf(times, options, isWeekdaysOnly),
  }
}
