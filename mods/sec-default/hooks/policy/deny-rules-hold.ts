import type { Settings } from 'claude-code'

import { ownOption } from './own-option'

/**
 * Whether deny rules hold over the plugins a person installs: they do unless
 * managed policy sets `allowModsToOverrideDenyRules` to the literal `true`.
 *
 * A value mistyped (`"true"`, `1`) loosens nothing. Only the policy source
 * is handed in, so a person's settings never reach this.
 *
 * @param policy the managed settings, as `$.settings.read` answers them
 * @returns false only when the organization let a person's plugins override
 */
export const denyRulesHold = (policy: Settings) =>
  ownOption(policy, 'allowModsToOverrideDenyRules') !== true
