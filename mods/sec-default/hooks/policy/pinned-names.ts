import type { Settings } from 'claude-code'

import { POLICY_SOURCE_VARIABLES } from './policy-source-variables.js'
import { PROCESS_WRAPPER_VARIABLE } from './process-wrapper-variable.js'

/**
 * The environment variables managed policy sets: every name of its `env`,
 * and the launcher's variable where it names one with `processWrapper`.
 *
 * Always among them: the variables that say where policy is read from.
 *
 * @param policy the managed settings, as `$.settings.read` answers them
 * @returns the names, as the policy spells them
 */
export function pinnedNames(policy: Settings): string[] {
  const isWrapped = policy.processWrapper !== undefined

  return [
    ...Object.keys(policy.env ?? {}),
    ...(isWrapped ? [PROCESS_WRAPPER_VARIABLE] : []),
    ...POLICY_SOURCE_VARIABLES,
  ]
}
