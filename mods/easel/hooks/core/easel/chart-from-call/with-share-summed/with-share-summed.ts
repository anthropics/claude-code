import type CoreCall from '../../../call'

/**
 * The parts of a share add up to the whole, so asking for one says "sum".
 *
 * @param asked The chart as the model asked for it.
 * @returns The same chart, a share combining by sum unless it says how.
 */
export const withShareSummed = (
  asked: CoreCall.ChartRequest,
): CoreCall.ChartRequest =>
  asked.form === 'share' ? { ...asked, combine: asked.combine ?? 'sum' } : asked
