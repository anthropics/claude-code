/**
 * Utility for checking git availability.
 *
 * Git is required for installing GitHub-based marketplaces. This module
 * provides a memoized check to determine if git is available on the system.
 */

import memoize from 'lodash-es/memoize.js'
import { which } from '../which.js'

/**
 * Check if a command is available in PATH.
 *
 * Uses which to find the actual executable without executing it.
 * This is a security best practice to avoid executing arbitrary code
 * in untrusted directories.
 *
 * @param command - The command to check for
 * @returns True if the command exists and is executable
 */
async function isCommandAvailable(command: string): Promise<boolean> {
  try {
    return !!(await which(command))
  } catch {
    return false
  }
}

/**
 * Check if git is available on the system.
 *
 * This is memoized so repeated calls within a session return the cached result.
 * Git availability is unlikely to change during a single CLI session.
 *
 * Only checks PATH — does not exec git. On macOS this means the /usr/bin/git
 * xcrun shim passes even without Xcode CLT installed; callers that hit
 * `xcrun: error:` at exec time should call markGitUnavailable() so the rest
 * of the session behaves as though git is absent.
 *
 * @returns True if git is installed and executable
 */
export const checkGitAvailable = memoize(async (): Promise<boolean> => {
  return isCommandAvailable('git')
})

/**
 * Force the memoized git-availability check to return false for the rest of
 * the session.
 *
 * Call this when a git invocation fails in a way that indicates the binary
 * exists on PATH but cannot actually run — the macOS xcrun shim being the
 * main case (`xcrun: error: invalid active developer path`). Subsequent
 * checkGitAvailable() calls then short-circuit to false, so downstream code
 * that guards on git availability skips cleanly instead of failing repeatedly
 * with the same exec error.
 *
 * lodash memoize uses a no-arg cache key of undefined.
 */
export function markGitUnavailable(): void {
  checkGitAvailable.cache?.set?.(undefined, Promise.resolve(false))
}

/**
 * Clear the git availability cache.
 * Used for testing purposes.
 */
export function clearGitAvailabilityCache(): void {
  checkGitAvailable.cache?.clear?.()
}
