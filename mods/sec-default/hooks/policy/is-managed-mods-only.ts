import type { Settings } from 'claude-code'

import { ownOption } from './own-option'

/**
 * Whether managed policy limits mods to the organization's: this plugin's
 * own option `allowManagedModsOnly` in managed settings.
 *
 * On unless absent or `false`: a value mistyped (`"true"`, `1`) still
 * locks, as the CLI's own managed locks read.
 *
 * @param policy the managed settings, as `$.settings.read` answers them
 * @returns true when the person's own mods are not to load
 */
export function isManagedModsOnly(policy: Settings) {
  const value = ownOption(policy, 'allowManagedModsOnly')

  return value !== undefined && value !== false
}
