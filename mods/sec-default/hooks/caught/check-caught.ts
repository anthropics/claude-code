import type { Args, Settings } from 'claude-code'

import { attempted } from '../attempted'
import HeldVerdict from '../held-verdict'
import Policy from '../policy'
import type Types from './types'

/**
 * The `tool.check` hook's failure handler: the failed hook's last run when
 * it vouches for itself, else a refusal; never over the tool's ceiling.
 *
 * Its own policy read fails closed and cannot throw: a read that rejects,
 * or throws where it is made, counts as deny rules holding.
 *
 * @param e the question
 * @param next the handler's continuation, with that run's trace
 * @param read the handler's own read of managed policy
 * @returns the verdict; nothing only when that run rejected and policy
 * lets plugins override deny rules
 */
export async function checkCaught(
  e: Args<'tool.check'>,
  next: Types.CheckNext,
  read: () => Promise<Settings>,
) {
  const last = await next(e).catch(() => undefined)

  const shouldVouch = await Policy.decidedByPolicy(
    attempted(read),
    Policy.denyRulesHold,
  )

  return HeldVerdict.underCeiling(
    shouldVouch ? HeldVerdict.caughtAnswer(last, next.trace) : last,
    e.ceiling,
  )
}
