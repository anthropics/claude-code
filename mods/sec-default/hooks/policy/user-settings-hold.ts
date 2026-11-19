import type { Settings } from 'claude-code'

import { isPersonWritable } from './is-person-writable.js'
import { ownOption } from './own-option'

/**
 * Whether the user settings file is held from a person's plugins: it is unless a
 * policy the person could not write sets `allowModsToWriteUserSettings` to `true`.
 *
 * @param policy the managed settings, as `$.settings.read` answers them
 * @returns false only when the organization let a person's plugins write it
 */
export const userSettingsHold = (policy: Settings) =>
  isPersonWritable(policy) ||
  ownOption(policy, 'allowModsToWriteUserSettings') !== true
