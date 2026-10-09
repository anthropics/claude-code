import { pastUsers } from '../past-users'
import type PastUsers from '../past-users'
import type Types from './types'

/**
 * The failure handler of a hook that lets an organization's subject
 * continue past the user tier: the hook's own decision, made again.
 *
 * Where the failed hook had already continued, that call's answer comes
 * back in its place. It reads the subject's pinned provider alone.
 *
 * @param e the event's input with its pinned `provider`
 * @param next the handler's continuation
 * @returns the hook's answer
 */
export const providedCaught = <E extends PastUsers.Provided, R>(
  e: E,
  next: Types.CaughtNext<E, R>,
) => (next.called ? next(e) : pastUsers(e, next))
