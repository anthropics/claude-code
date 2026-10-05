import type { EventResult } from 'claude-code'

import Ranking from './ranking'

/**
 * What the failure handler answers in place of a verdict over the ceiling
 * an organization set on a tool: the ceiling's own verdict.
 *
 * @param ceiling the question's `ceiling`, which the engine pins
 * @returns the verdict
 */
export const uncheckedCeiling = (
  ceiling: string,
): EventResult<'tool.check'> => ({
  decision: Ranking.ceilingVerdict(ceiling),
  reason:
    'the limit your organization set on this tool could not be checked ' +
    'for this call, so the call goes no further than the limit',
})
