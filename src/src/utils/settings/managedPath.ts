import memoize from 'lodash-es/memoize.js'
import { join } from 'path'
import { getPlatform } from '../platform.js'

/**
 * Get the path to the managed settings directory based on the current platform.
 */
export const getManagedFilePath = memoize(function (): string {
  // Allow override for testing/demos (Ant-only, eliminated from external builds)
  if (
    process.env.USER_TYPE === 'ant' &&
    process.env.CLAUDE_CODE_MANAGED_SETTINGS_PATH
  ) {
    return process.env.CLAUDE_CODE_MANAGED_SETTINGS_PATH
  }

  switch (getPlatform()) {
    case 'macos':
      return '/Library/Application Support/ClaudeCode'
    case 'windows':
      return 'C:\\Program Files\\ClaudeCode'
    default:
      return '/etc/claude-code'
  }
})

/**
 * Get the path to the managed-settings.d/ drop-in directory.
 * managed-settings.json is merged first (base), then files in this directory
 * are merged alphabetically on top (drop-ins override base, later files win).
 */
export const getManagedSettingsDropInDir = memoize(function (): string {
  return join(getManagedFilePath(), 'managed-settings.d')
})
