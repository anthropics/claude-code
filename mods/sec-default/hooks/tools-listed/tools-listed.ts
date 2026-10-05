import type { Settings, ToolInfo, ValueOrDeny } from 'claude-code'

import type { ProvidedNext } from '../past-users'
import Policy from '../policy'

/**
 * What the `tool.list` hook answers: the listing through every tier and the
 * one past the user tier, merged by managed policy.
 *
 * Both runs start together, the one past the user tier last.
 *
 * @param policy the managed settings, or undefined when the read failed
 * @param e the event's input
 * @param next the hook's own continuation
 * @returns the merged answer
 */
export async function toolsListed<E>(
  policy: Settings | undefined,
  e: E,
  next: ProvidedNext<E, ValueOrDeny<ToolInfo[]>>,
) {
  const [seen, real] = await Promise.all([next(e), next.to(e, 'append')])

  return Policy.managedToolsRestored(policy, real, seen)
}
