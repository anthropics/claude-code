import type { Settings } from 'claude-code'

import { isPersonWritable } from './is-person-writable.js'
import { ownOption } from './own-option'

/**
 * Whether deny rules hold over the plugins a person installs: they do unless
 * an administrator's policy sets `allowModsToOverrideDenyRules` to `true`.
 *
 * Ask rules and classic hooks' answers hold or not with them. A value mistyped
 * (`"true"`, `1`) loosens nothing, and neither does the option in a policy the
 * person could have written (isPersonWritable).
 *
 * @param policy the managed settings, as `$.settings.read` answers them
 * @returns false only when the organization let a person's plugins override
 */
export const denyRulesHold = (policy: Settings) =>
  isPersonWritable(policy) ||
  ownOption(policy, 'allowModsToOverrideDenyRules') !== true
