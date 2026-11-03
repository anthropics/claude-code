import type { Settings } from 'claude-code'

import { pinnedNames } from './pinned-names.js'

/**
 * Whether managed policy pins an environment variable: it sets the name
 * (pinnedNames), in any case (some systems read `Path` and `PATH` as one).
 *
 * @param policy the managed settings, as `$.settings.read` answers them
 * @param name the variable a plugin would set or unset
 * @returns true when the organization set it
 */
export const isPinnedVariable = (policy: Settings, name: string): boolean =>
  pinnedNames(policy).some(
    pinned => pinned.toUpperCase() === name.toUpperCase(),
  )
