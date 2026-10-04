import type Provided from './provided'
import { USER_REACHABLE_TIERS } from './user-reachable-tiers'

/**
 * What the `tool.describe`, `command.describe`, `agent.offer` and
 * `agent.spawn` hooks do: an organization's subject continues past users.
 *
 * The subject is the organization's unless its pinned `e.provider.tier` is
 * `user`, `builtin` or `core`: a policy-installed plugin (`prepend`,
 * `append`), the managed folder, a policy MCP server, or no provider at all.
 *
 * @param e the event's input with its pinned `provider`
 * @param next the hook's own continuation, handed whole
 * @returns the result from append inward, or from every tier
 */
export function pastUsers<E extends Provided.Provided, R>(
  e: E,
  next: Provided.ProvidedNext<E, R>,
): Promise<R> {
  const isUsers = USER_REACHABLE_TIERS.includes(e.provider?.tier)

  return isUsers ? next(e) : next.to(e, 'append')
}
