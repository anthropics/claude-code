import type CoreCall from '../../../call'
import Forms from '../../../forms'
import type Reading from '../../../reading'

/**
 * Bars take the place of a form over time only where each name gets its bar.
 *
 * Past that count bars are ranked by size and the rest are cut, and names such
 * as `Jan 2024` would lose their order: the model is asked. Where bars do not
 * fit either, their reason follows the reason that they were read.
 *
 * @param read The refusal of the form over time.
 * @param bars The same rows as they were read for bars.
 * @param request The chart as the model asked for it.
 * @returns The bars to draw, or the refusal to give.
 */
export function barsInPlaceOf(
  read: Reading.ReadFailure,
  bars: Reading.Data | Reading.ReadFailure,
  request: CoreCall.ChartRequest,
): Reading.Data | Reading.ReadFailure {
  const areBarsRead = bars.kind === 'data'

  if (areBarsRead) {
    const hasBarForEach =
      bars.series.length <= (request.top ?? Forms.FORMS.bars.defaultCount)

    return hasBarForEach ? bars : read
  }

  return {
    ...bars,
    problem: {
      ...bars.problem,
      why:
        `${request.x ?? 'x'} holds names, not times, so bars were read. ` +
        bars.problem.why,
    },
  }
}
