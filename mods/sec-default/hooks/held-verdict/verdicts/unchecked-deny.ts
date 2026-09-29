import type { EventResult } from 'claude-code'

/**
 * What the failure handler answers when a verdict was loosened, or never
 * reached, and no deny rule check vouches for it: absent counts as deny.
 */
export const UNCHECKED_DENY: EventResult<'tool.check'> = Object.freeze({
  decision: 'deny',
  reason:
    'the deny rules in your settings could not be checked for this call, ' +
    'so it is refused',
})
