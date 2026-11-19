import Calendar from '../../calendar'
import type Reading from '../../reading'

/**
 * The first sample wins a tie.
 *
 * @param series the series to search
 * @param timeline the span and precision the time is written in
 * @returns the time of the largest sample, as a label
 */
export function peakTimeOf(
  series: Reading.Series,
  timeline: Reading.Timeline,
): string {
  let peak = { ms: 0, value: -Infinity }

  for (const { ms, value } of series.samples) {
    const isHigher = value !== null && value > peak.value

    if (isHigher) {
      peak = { ms, value }
    }
  }

  return Calendar.timeLabelIn(timeline, peak.ms)
}
