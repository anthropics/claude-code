import type { Settings } from 'claude-code'

import { memberOf } from './member-of'
import { OWN_OPTIONS_PATH } from './own-options-path'

/**
 * One option an administrator set for this plugin in managed settings: its
 * value under the plugin's own `pluginConfigs` entry, as written.
 *
 * Hand it the policy source alone, so a person's settings never reach it.
 *
 * @param policy the managed settings, as `$.settings.read` answers them
 * @param name the option's name
 * @returns the value, or undefined when the option is not set
 */
export const ownOption = (policy: Settings, name: string): unknown =>
  [...OWN_OPTIONS_PATH, name].reduce<unknown>(memberOf, policy)
