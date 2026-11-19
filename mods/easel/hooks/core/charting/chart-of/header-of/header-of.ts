import type CoreCall from '../../../call'
import Casting from '../../../casting'
import type Reading from '../../../reading'
import type Types from '../../types'

/**
 * Shapes what stands above the drawing.
 *
 * @param data the series that were read, with where they came from
 * @param request what the call asked for
 * @param facts the short statements about the whole chart, in their order
 * @returns the title, the statements, and the source
 */
export const headerOf = (
  data: Reading.Data,
  request: CoreCall.ChartRequest,
  facts: string[],
): Types.Header => ({
  title: request.title ?? '',
  facts,
  source: Casting.shownSourceOf(data),
})
