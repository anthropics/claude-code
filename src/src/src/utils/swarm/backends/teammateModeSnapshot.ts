/**
 * Teammate mode snapshot module.
 *
 * Captures the teammate mode at session startup, following the same pattern
 * as hooksConfigSnapshot.ts. This ensures that runtime config changes don't
 * affect the teammate mode for the current session.
 */

import { getGlobalConfig } from '../../../utils/config.js'
import { logForDebugging } from '../../../utils/debug.js'
import { logError } from '../../../utils/log.js'

export type TeammateMode = 'auto' | 'tmux' | 'in-process'

// Module-level variable to hold the captured mode at startup
let initialTeammateMode: TeammateMode | null = null

// CLI override (set before capture if --teammate-mode is provided)
let cliTeammateModeOverride: TeammateMode | null = null

/**
 * Set the CLI override for teammate mode.
 * Must be called before captureTeammateModeSnapshot().
 */
export function setCliTeammateModeOverride(mode: TeammateMode): void {
  cliTeammateModeOverride = mode
}

/**
 * Get the current CLI override, if any.
 * Returns null if no CLI override was set.
 */
export function getCliTeammateModeOverride(): TeammateMode | null {
  return cliTeammateModeOverride
}

/**
 * Clear the CLI override and update the snapshot to the new mode.
 * Called when user changes the setting in the UI, allowing their change to take effect.
 *
 * @param newMode - The new mode the user selected (passed directly to avoid race condition)
 */
export function clearCliTeammateModeOverride(newMode: TeammateMode): void {
  cliTeammateModeOverride = null
  initialTeammateMode = newMode
  logForDebugging(
    `[TeammateModeSnapshot] CLI override cleared, new mode: ${newMode}`,
  )
}

/**
 * Capture the teammate mode at session startup.
 * Called early in main.tsx, after CLI args are parsed.
 * CLI override takes precedence over config.
 */
export function captureTeammateModeSnapshot(): void {
  if (cliTeammateModeOverride) {
    initialTeammateMode = cliTeammateModeOverride
    logForDebugging(
      `[TeammateModeSnapshot] Captured from CLI override: ${initialTeammateMode}`,
    )
  } else {
    const config = getGlobalConfig()
    initialTeammateMode = config.teammateMode ?? 'auto'
    logForDebugging(
      `[TeammateModeSnapshot] Captured from config: ${initialTeammateMode}`,
    )
  }
}

/**
 * Get the teammate mode for this session.
 * Returns the snapshot captured at startup, ignoring any runtime config changes.
 */
export function getTeammateModeFromSnapshot(): TeammateMode {
  if (initialTeammateMode === null) {
    // This indicates an initialization bug - capture should happen in setup()
    logError(
      new Error(
        'getTeammateModeFromSnapshot called before capture - this indicates an initialization bug',
      ),
    )
    captureTeammateModeSnapshot()
  }
  // Fallback to 'auto' if somehow still null (shouldn't happen, but safe)
  return initialTeammateMode ?? 'auto'
}
