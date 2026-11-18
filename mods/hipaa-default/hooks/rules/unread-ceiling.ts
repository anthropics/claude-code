import type { EventResult, NextOrigin } from 'claude-code'

/**
 * The refusal of a call that could not be matched against the organization's
 * deny rules, for any caller but the engine and the organization's own code.
 *
 * @param tool the tool called
 * @param origin who makes the call (`next.origin`)
 * @returns the deny, or undefined for a call decided beneath
 */
export function unreadCeilingRefusal(
  tool: string,
  origin: NextOrigin,
): EventResult<'tool.check'> | undefined {
  return origin.tier === 'core' || origin.isOrganizations === true
    ? undefined
    : {
        decision: 'deny',
        reason:
          `${tool} could not be checked against the rules set by your ` +
          'organization or for this session.',
      }
}
