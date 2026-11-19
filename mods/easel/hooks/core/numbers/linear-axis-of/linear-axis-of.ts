import Lists from '../../lists'
import { formatAll } from '../format-all'
import Limits from '../limits'
import Records from '../records'
import type Types from '../types'
import { flatRangeOf } from './flat-range-of'
import { isFlatRange } from './is-flat-range'
import { tickFormatOf } from './tick-format-of'

/**
 * Builds the ticks of a value axis whose steps are even: 1, 2 or 5 times a
 * power of ten, all written alike.
 *
 * Snapping the low end down to a tick can add one step to the most asked for.
 *
 * @param format How the values of the axis are written.
 * @param range The least and the greatest value, in base units.
 * @param maxSteps The most steps the axis should have.
 * @returns The ticks and where a value falls among them.
 */
export function linearAxisOf(
  format: Types.NumberFormat,
  [min, max]: Types.ValueRange,
  maxSteps: number,
): Types.ValueAxis {
  const low = min * format.multiplesPerUnit
  const high = max * format.multiplesPerUnit
  const roughStep =
    (isFlatRange(low, high) ? flatRangeOf(high) : high - low) / maxSteps
  const power = Limits.DECIMAL_BASE ** Math.floor(Math.log10(roughStep))
  const step =
    power *
    (Records.NICE_STEPS.find(nice => nice * power >= roughStep) ??
      Limits.NEXT_POWER_OF_TEN)
  const firstMultiple = Math.floor(low / step + Limits.EPSILON)
  const axisLow = firstMultiple * step
  const stepCount = Math.max(
    1,
    Math.ceil((high - axisLow) / step - Limits.EPSILON),
  )

  return {
    ticks: formatAll(
      tickFormatOf(format, step),
      Lists.indexesBelow(stepCount + 1).map(
        tickIndex => (firstMultiple + tickIndex) * step,
      ),
    ).map((label, tickIndex) => ({
      position: tickIndex / stepCount,
      label,
    })),
    positionOf: value =>
      (value * format.multiplesPerUnit - axisLow) / (stepCount * step),
  }
}
