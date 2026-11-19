import type CoreCall from '../../../call'

/**
 * The same call for bars. A log scale goes with the line it was meant for:
 * bars stand on zero.
 *
 * @param request The chart as the model asked for it.
 * @returns The call that is read in its place.
 */
export const asBars = (
  request: CoreCall.ChartRequest,
): CoreCall.ChartRequest => ({ ...request, form: 'bars', log: undefined })
