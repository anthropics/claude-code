import Lists from '../lists'
import { formatAlone } from './format-alone'
import Limits from './limits'
import type Types from './types'

/**
 * Builds the ticks of a value axis whose steps are powers of ten.
 *
 * @param unit The unit the axis is in.
 * @param range The least and the greatest value, both above zero.
 * @param maxSteps The most steps the axis may have.
 * @returns The ticks, each written alone, and where a value falls among them.
 */
export function logAxisOf(
  unit: string,
  [min, max]: Types.ValueRange,
  maxSteps: number,
): Types.ValueAxis {
  const lowestPower = Math.floor(Math.log10(min) + Limits.EPSILON)
  const powerCount = Math.max(
    1,
    Math.ceil(Math.log10(max) - Limits.EPSILON) - lowestPower,
  )
  const powersPerStep = Math.ceil(powerCount / maxSteps)
  const stepCount = Math.ceil(powerCount / powersPerStep)

  return {
    ticks: Lists.indexesBelow(stepCount + 1).map(tickIndex => ({
      position: tickIndex / stepCount,
      label: formatAlone(
        Limits.DECIMAL_BASE ** (lowestPower + tickIndex * powersPerStep),
        unit,
      ),
    })),
    positionOf: value =>
      (Math.log10(value) - lowestPower) / (stepCount * powersPerStep),
  }
}
