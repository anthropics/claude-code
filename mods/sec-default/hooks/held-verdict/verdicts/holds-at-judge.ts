import type { Args, EventResult } from 'claude-code'

import { isSameVerdict } from './is-same-verdict.js'
import Ranking from './ranking'

/**
 * Whether the verdict reached past the user tier on `tool.judge` holds over
 * the chain's answer, on a call that answer's plugin did not make itself.
 *
 * The event does not say what stands behind the ask that brought the call
 * there, so their allow never takes the classifier's place. A deny holds over
 * their ask. With no verdict their ask stands, but where a host answers it or
 * a ceiling caps the tool. Their deny is final where the classifier's is not.
 *
 * @param held what the run past the user tier settled on
 * @param answer what the whole chain settled on
 * @param e the call: who answers its asks, and the ceiling on its tool
 * @returns true when the held verdict is the one to return, as it is
 */
export function holdsAtJudge(
  held: EventResult<'tool.judge'>,
  answer: EventResult<'tool.judge'>,
  e: Pick<Args<'tool.judge'>, 'approver' | 'ceiling'>,
): boolean {
  return (
    !Ranking.isLooser(held, answer) &&
    !isSameVerdict(held, answer) &&
    (held.plugin !== undefined ||
      Ranking.isLooser(answer, held) ||
      answer.decision === 'allow' ||
      (answer.decision === 'ask' &&
        (e.approver === 'host' || e.ceiling !== undefined)))
  )
}
