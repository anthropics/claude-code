import type { SeriesOptions } from '../../reading/types/series-of/series-options'
import { calendarFieldsAt } from '../calendar-fields-at'
import { CALENDAR_UNITS } from '../calendar-units'
import { isWeekend } from '../is-weekend'
import Limits from '../limits'
import type Types from '../types'
import { gridOfStep } from './grid-of-step'
import { gridZonesOf } from './grid-zones-of'
import { isChangedBetween } from './is-changed-between'
import { spanBetween } from './span-between'
import { stepGapOf } from './step-gap-of'
import { stepOfGap } from './step-of-gap'

/**
 * Finds the even calendar step that every sample sits on, if there is one.
 *
 * @param sortedMs the instants of the samples, rising
 * @param seriesOptions how the series are read, for where they were written
 * @param onWeekdays whether the samples keep to weekdays
 * @returns the grid of periods, or null where the samples are not even
 */
export function sampleGridOf(
  sortedMs: number[],
  seriesOptions: SeriesOptions,
  onWeekdays: boolean,
): Types.SampleGrid | null {
  const { zone } = seriesOptions
  const firstMs = sortedMs[0]
  const lastMs = sortedMs.at(-1)
  const hasSpan =
    firstMs !== undefined &&
    lastMs !== undefined &&
    sortedMs.length >= Limits.MIN_SAMPLES_FOR_A_GRID

  if (!hasSpan) {
    return null
  }

  const gaps = sortedMs
    .slice(1)
    .map((ms, index) => ms - (sortedMs[index] ?? ms))
  const medianGap = stepGapOf(gaps)
  const isTooSparse =
    (lastMs - firstMs) / medianGap >
    sortedMs.length * Limits.MAX_PERIODS_PER_SAMPLE

  if (isTooSparse) {
    return null
  }

  const beforeGapMs = sortedMs[gaps.indexOf(medianGap)] ?? firstMs

  for (const gridZone of gridZonesOf(medianGap, zone)) {
    const unit = CALENDAR_UNITS.findLast(
      isChangedBetween(
        calendarFieldsAt(beforeGapMs, gridZone),
        calendarFieldsAt(beforeGapMs + medianGap, gridZone),
      ),
    )

    if (!unit) {
      return null
    }

    const step = stepOfGap(unit, medianGap, onWeekdays)
    const grid = gridOfStep(
      sortedMs,
      step,
      spanBetween(firstMs, lastMs, gridZone),
    )

    if (grid) {
      return {
        ...grid,
        periodStarts: grid.periodStarts.filter(
          ms => !(step.skipsWeekends && isWeekend(ms, zone)),
        ),
      }
    }
  }

  return null
}
