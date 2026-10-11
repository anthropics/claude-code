import type { EventResult } from 'claude-code'

import { isSameVerdict } from './is-same-verdict.js'
import Ranking from './ranking'

/**
 * Whether the verdict reached past the user tier holds whole over the
 * chain's answer: a deny, or an ask a rule, a hook or a ceiling stands behind.
 *
 * It holds over a more permissive answer and over the same decision reworded
 * or stripped of its rule or hook; a stricter answer stands. Any rule or
 * classic hook counts, whoever configured it, and so does the ceiling an
 * organization set on the tool. The mode's own ask, with none, never holds.
 *
 * @param held what the run past the user tier settled on
 * @param answer what the whole chain settled on
 * @returns true when the held verdict is the one to return, as it is
 */
export const holdsOver = (
  held: EventResult<'tool.check'>,
  answer: EventResult<'tool.check'>,
) =>
  !Ranking.isLooser(held, answer) &&
  !isSameVerdict(held, answer) &&
  (held.decision === 'deny' ||
    held.rule !== undefined ||
    held.hook !== undefined ||
    held.ceiling !== undefined)
