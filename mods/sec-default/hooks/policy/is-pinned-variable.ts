import type { Settings } from 'claude-code'

import { pinnedNames } from './pinned-names.js'
import { ROUTING_VARIABLES } from './routing-variables.js'

/**
 * Whether an environment variable is pinned in every session: by name
 * (pinnedNames) or by pattern (ROUTING_VARIABLES), in any case (some systems
 * read `Path` and `PATH` as one).
 *
 * @param policy the managed settings, as `$.settings.read` answers them
 * @param name the variable a plugin would set or unset
 * @returns true when it is pinned
 */
export const isPinnedVariable = (policy: Settings, name: string): boolean =>
  ROUTING_VARIABLES.some(pattern => pattern.test(name.toUpperCase())) ||
  pinnedNames(policy).some(
    pinned => pinned.toUpperCase() === name.toUpperCase(),
  )
