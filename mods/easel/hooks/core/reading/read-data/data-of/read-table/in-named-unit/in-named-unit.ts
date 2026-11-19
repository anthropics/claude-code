import type CoreCall from '../../../../../call'
import Cells from '../../../../../cells'
import type Types from '../../../../types'

/**
 * A number with no unit of its own is in the unit the call names.
 *
 * @param parsed the cell as it was read
 * @param request the chart that was asked for, which may name a unit
 * @returns the number scaled to that unit, or the reading as it was
 */
export function inNamedUnit(
  parsed: Types.NumberReading,
  request: CoreCall.ChartRequest,
): Types.NumberReading {
  const unit = request.unit
  const isNumberInTheNamedUnit =
    parsed.kind === 'number' && !parsed.unit && !!unit

  return isNumberInTheNamedUnit
    ? Cells.scaledBySuffix(parsed.value, unit)
    : parsed
}
