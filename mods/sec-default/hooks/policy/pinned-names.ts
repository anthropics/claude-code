import type { Settings } from 'claude-code'

import { CODE_LOADING_VARIABLES } from './code-loading-variables.js'
import { POLICY_SOURCE_VARIABLES } from './policy-source-variables.js'
import { PROCESS_WRAPPER_VARIABLE } from './process-wrapper-variable.js'

/**
 * The environment variables managed policy sets: every name of its `env`,
 * and the launcher's variable where it names one with `processWrapper`.
 *
 * Always among them: the variables that say where policy is read from,
 * and the ones that can load code into a child the engine starts.
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
    ...CODE_LOADING_VARIABLES,
  ]
}
