import type { Settings } from 'claude-code'

import { ownOption } from './own-option'

/**
 * Whether managed policy keeps a question before a mod Claude wrote turns on: this
 * plugin's own option `forceHotReloadPrompt` in managed settings.
 *
 * On unless absent or `false`: a value mistyped (`"true"`, `1`) still asks, as
 * the CLI's own managed locks read.
 *
 * @param policy the managed settings, as `$.settings.read` answers them
 * @returns true when such a mod is to be asked about
 */
export function isHotReloadPromptForced(policy: Settings) {
  const value = ownOption(policy, 'forceHotReloadPrompt')

  return value !== undefined && value !== false
}
