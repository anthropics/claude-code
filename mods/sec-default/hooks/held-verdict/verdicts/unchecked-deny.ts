import type { EventResult } from 'claude-code'

/**
 * What the failure handler answers when a verdict was loosened, or never
 * reached, and no check of the rules and hooks vouches for it: a deny.
 */
export const UNCHECKED_DENY: EventResult<'tool.check'> = Object.freeze({
  decision: 'deny',
  reason:
    'the rules and hooks in your settings could not be checked for this ' +
    'call, so it is refused',
})
