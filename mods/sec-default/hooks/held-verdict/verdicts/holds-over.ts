import type { EventResult } from 'claude-code'

import { isPersonTightening } from './is-person-tightening.js'
import { isSameVerdict } from './is-same-verdict.js'
import Ranking from './ranking'

/**
 * Whether the verdict reached past the user tier holds whole over the
 * chain's answer: a deny, or an ask that names what stands behind it.
 *
 * It holds over a more permissive answer and over the same decision reworded
 * or stripped of what it names; a stricter answer stands, and so does a host's
 * ask that only changed who answers it to a person. A rule, a hook, a
 * setting, a host, a person or a ceiling counts; the mode's own ask at a
 * dialog never.
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
  !isPersonTightening(held, answer) &&
  (held.decision === 'deny' ||
    held.rule !== undefined ||
    held.hook !== undefined ||
    held.setting !== undefined ||
    held.decider !== undefined ||
    held.ceiling !== undefined)
