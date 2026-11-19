import type Refusal from '../../../refusal'
import Texts from '../../../texts'
import type { Usage } from '../../../usage'
import Limits from '../../limits'
import { refuse } from '../../refuse'
import type Types from '../../types'

/**
 * Refuses for want of anything to read, and offers the latest of the other
 * tool results by id, so that the model can name one.
 *
 * @param problem What went wrong, worded where it was found.
 * @param otherResults The tool results that were not the one read.
 * @param usage What telemetry is told of the call, but for the code.
 * @returns The refusal the model reads.
 */
export function noDataRefusal(
  problem: Refusal.Problem,
  otherResults: Types.ToolResult[],
  usage: Usage,
): Types.RefusedChart {
  const resultLines = otherResults
    .slice(-Limits.MAX_RESULTS_LISTED)
    .map(
      ({ id, tool, text }) =>
        `${Texts.cleanLabel(id, Limits.MAX_ID_WIDTH)} ` +
        `(${Texts.cleanLabel(tool, Limits.MAX_ID_WIDTH)}, ` +
        `${Texts.counted(text.length, 'character')})`,
    )
  const hasOthers = resultLines.length > 0

  return refuse(
    problem.code,
    [
      problem.why + (hasOthers ? '\nOr name another tool result:' : ''),
      ...resultLines,
    ],
    usage,
  )
}
