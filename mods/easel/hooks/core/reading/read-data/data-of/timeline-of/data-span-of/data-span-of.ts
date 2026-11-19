import type Calendar from '../../../../../calendar'
import type Types from '../../../../types'

/**
 * From the first sample to the last; no time at all is a span of one instant.
 *
 * @param options the sorted times of all the series, and their zone
 * @returns the span that the data covers
 */
export function dataSpanOf(options: Types.TimelineOptions): Calendar.TimeSpan {
  const fromMs = options.times[0] ?? 0

  return {
    fromMs,
    untilMs: options.times.at(-1) ?? fromMs,
    zone: options.zone,
  }
}
