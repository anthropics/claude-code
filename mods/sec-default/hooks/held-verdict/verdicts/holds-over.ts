import type { EventResult } from 'claude-code'

import Ranking from './ranking'

/**
 * Whether the verdict reached past the user tier holds over the chain's
 * answer: it is the stricter, and a deny, or an ask a settings rule decided.
 *
 * Any rule counts, whoever configured it: a verdict names the rule, never its
 * source. A deny holds unnamed: it may stand before a rule's ask. The mode's
 * own ask does not hold, nor a settings hook's.
 *
 * @param held what the run past the user tier settled on
 * @param answer what the whole chain settled on
 * @returns true when the plugins a person installs may not have loosened it
 */
export const holdsOver = (
  held: EventResult<'tool.check'>,
  answer: EventResult<'tool.check'>,
) =>
  Ranking.isLooser(answer, held) &&
  (held.decision === 'deny' || held.rule !== undefined)
