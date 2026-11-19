import Calendar from '../../../../calendar'
import Lists from '../../../../lists'
import type Types from '../../../types'
import { dataSpanOf } from './data-span-of'
import { spanLabelling } from './span-labelling'

/**
 * Where the samples start and end, how they step, and what labels say so.
 *
 * @param options the times of all the series, their grid and their zone
 * @returns the time axis for the form that the columns are read as
 */
export function timelineOf(options: Types.TimelineOptions): Types.Timeline {
  const dataSpan = dataSpanOf(options)
  const precision = Calendar.precisionOf(options.times, options.zone)
  const periods = options.readAs === 'columns' ? options.grid : null
  const isBars = options.readAs === 'bars'
  const spanLabel = Calendar.timeLabels(
    Lists.distinct([dataSpan.fromMs, dataSpan.untilMs]),
    precision,
    spanLabelling(options),
  ).join(' → ')

  return {
    dataSpan,
    axisSpan: periods ? { ...dataSpan, untilMs: periods.endMs } : dataSpan,
    precision,
    step: options.grid?.step ?? precision,
    spanLabels: isBars
      ? []
      : [options.isZoned ? `${spanLabel} ${options.zone}` : spanLabel],
    periodStarts: periods?.periodStarts ?? [],
  }
}
