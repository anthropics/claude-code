/**
 * Shared constants and path builders for MDM settings modules.
 *
 * This module has ZERO heavy imports (only `os`) — safe to use from mdmRawRead.ts.
 * Both mdmRawRead.ts and mdmSettings.ts import from here to avoid duplication.
 */

import { homedir, userInfo } from 'os'
import { join } from 'path'

/** macOS preference domain for Claude Code MDM profiles. */
export const MACOS_PREFERENCE_DOMAIN = 'com.anthropic.claudecode'

/**
 * Windows registry key paths for Claude Code MDM policies.
 *
 * These keys live under SOFTWARE\Policies which is on the WOW64 shared key
 * list — both 32-bit and 64-bit processes see the same values without
 * redirection. Do not move these to SOFTWARE\ClaudeCode, as SOFTWARE is
 * redirected and 32-bit processes would silently read from WOW6432Node.
 * See: https://learn.microsoft.com/en-us/windows/win32/winprog64/shared-registry-keys
 */
export const WINDOWS_REGISTRY_KEY_PATH_HKLM =
  'HKLM\\SOFTWARE\\Policies\\ClaudeCode'
export const WINDOWS_REGISTRY_KEY_PATH_HKCU =
  'HKCU\\SOFTWARE\\Policies\\ClaudeCode'

/** Windows registry value name containing the JSON settings blob. */
export const WINDOWS_REGISTRY_VALUE_NAME = 'Settings'

/** Path to macOS plutil binary. */
export const PLUTIL_PATH = '/usr/bin/plutil'

/** Arguments for plutil to convert plist to JSON on stdout (append plist path). */
export const PLUTIL_ARGS_PREFIX = ['-convert', 'json', '-o', '-', '--'] as const

/** Subprocess timeout in milliseconds. */
export const MDM_SUBPROCESS_TIMEOUT_MS = 5000

/**
 * Build the list of macOS plist paths in priority order (highest first).
 * Evaluates `process.env.USER_TYPE` at call time so ant-only paths are
 * included only when appropriate.
 */
export function getMacOSPlistPaths(): Array<{ path: string; label: string }> {
  let username = ''
  try {
    username = userInfo().username
  } catch {
    // ignore
  }

  const paths: Array<{ path: string; label: string }> = []

  if (username) {
    paths.push({
      path: `/Library/Managed Preferences/${username}/${MACOS_PREFERENCE_DOMAIN}.plist`,
      label: 'per-user managed preferences',
    })
  }

  paths.push({
    path: `/Library/Managed Preferences/${MACOS_PREFERENCE_DOMAIN}.plist`,
    label: 'device-level managed preferences',
  })

  // Allow user-writable preferences for local MDM testing in ant builds only.
  if (process.env.USER_TYPE === 'ant') {
    paths.push({
      path: join(
        homedir(),
        'Library',
        'Preferences',
        `${MACOS_PREFERENCE_DOMAIN}.plist`,
      ),
      label: 'user preferences (ant-only)',
    })
  }

  return paths
}
