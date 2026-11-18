import type { EventResult, NextOrigin } from 'claude-code'

/**
 * The refusal of a call to a tool an administrator blocked, for any caller
 * but the engine and the organization's own code: those are decided beneath.
 *
 * @param tool the blocked tool
 * @param origin who makes the call (`next.origin`)
 * @returns the deny, or undefined for a call decided beneath
 */
export function blockedToolRefusal(
  tool: string,
  origin: NextOrigin,
): EventResult<'tool.check'> | undefined {
  return origin.tier === 'core' || origin.isOrganizations === true
    ? undefined
    : {
        decision: 'deny',
        reason:
          `${tool} is blocked by your organization or role, ` +
          'or switched off for this session.',
      }
}
