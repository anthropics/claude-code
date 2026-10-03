import type { EventResult } from 'claude-code'

import Ranking from './ranking'

/**
 * Whether the verdict reached past the user tier holds over the chain's
 * answer: it is the stricter, and a deny, or an ask a rule or a hook decided.
 *
 * Any rule or classic hook counts, whoever configured it: a verdict names the
 * rule and the hook's event, never their source. A deny holds unnamed: it may
 * stand before a rule's or a hook's ask. The mode's own ask does not hold.
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
  (held.decision === 'deny' ||
    held.rule !== undefined ||
    held.hook !== undefined)
