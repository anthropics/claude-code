import type { EventResult } from 'claude-code'

import { isSameVerdict } from './is-same-verdict.js'

/**
 * Whether an answer is a host's ask with nothing changed but its `decider`,
 * now a person: the same ask, which no classifier's allow settles.
 *
 * @param held what the run past the user tier settled on
 * @param answer what the whole chain settled on
 * @returns true when the answer only tightened the ask
 */
export function isPersonTightening(
  held: EventResult<'tool.check'>,
  answer: EventResult<'tool.check'>,
): boolean {
  const decider: string | undefined = answer.decider

  return (
    held.decision === 'ask' &&
    held.decider === 'host' &&
    decider === 'person' &&
    isSameVerdict({ ...held, decider: undefined }, {
      ...answer,
      decider: undefined,
    })
  )
}
