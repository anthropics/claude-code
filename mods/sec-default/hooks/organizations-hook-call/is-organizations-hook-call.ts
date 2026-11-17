import type { NextOrigin } from 'claude-code'

/**
 * Whether a `tool.check` is raised for the call of a settings hook that is or
 * may be the organization's, which a person's plugin could skip by refusing it.
 *
 * @param origin who raised it (`next.origin`)
 * @returns true for such a call
 */
export function isOrganizationsHookCall(origin: NextOrigin): boolean {
  return origin.hookOwner === 'organization' || origin.hookOwner === 'unknown'
}
