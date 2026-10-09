import type Types from './types'

/**
 * The failure handler of a hook whose refusal is the run past the user tier
 * (`classic.*`, `settings.read`, `tool.list`, `ui.log`), with no call on `$`.
 *
 * Where the failed hook had already continued, that call's answer comes
 * back in its place.
 *
 * @param e the event's input
 * @param next the handler's continuation
 * @returns the run past the user tier, or the failed hook's last call
 */
export const pastUsersCaught = <E, R>(e: E, next: Types.CaughtNext<E, R>) =>
  next.called ? next(e) : next.to(e, 'append')
