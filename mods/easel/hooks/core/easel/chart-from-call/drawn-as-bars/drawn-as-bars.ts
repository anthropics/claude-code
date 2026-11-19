import type CoreCall from '../../../call'
import type Reading from '../../../reading'
import type { Usage } from '../../../usage'
import { drawnChartOf } from '../../drawn-chart-of'
import type Types from '../../types'
import { asBars } from '../as-bars'

/**
 * Bars in place of the form over time that the call was read as, with a note
 * that says so.
 *
 * The refusal would advise bars, and no other form fits an x of names.
 *
 * @param bars The rows as they were read for bars.
 * @param request The chart as the model asked for it.
 * @param usage What telemetry is told of the call so far.
 * @returns The bars, marked as not the form that was named.
 */
export const drawnAsBars = (
  bars: Reading.Data,
  request: CoreCall.ChartRequest,
  usage: Usage,
): Types.DrawnChart =>
  drawnChartOf(
    {
      ...bars,
      notes: [
        `drawn as bars, not as ${request.form ?? 'line'}: ` +
          `${request.x ?? 'x'} holds names, not times`,
        ...bars.notes,
      ],
    },
    asBars(request),
    { ...usage, isFormReplaced: true },
  )
