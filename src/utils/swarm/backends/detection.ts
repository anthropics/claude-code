import { env } from '../../../utils/env.js'
import { execFileNoThrow } from '../../../utils/execFileNoThrow.js'
import { TMUX_COMMAND } from '../constants.js'

/**
 * Captured at module load time to detect if the user started Claude from within tmux.
 * Shell.ts may override TMUX env var later, so we capture the original value.
 */
// eslint-disable-next-line custom-rules/no-process-env-top-level
const ORIGINAL_USER_TMUX = process.env.TMUX

/**
 * Captured at module load time to get the leader's tmux pane ID.
 * TMUX_PANE is set by tmux to the pane ID (e.g., %0, %1) when a process runs inside tmux.
 * We capture this at startup so we always know the leader's original pane, even if
 * the user switches to a different pane later.
 */
// eslint-disable-next-line custom-rules/no-process-env-top-level
const ORIGINAL_TMUX_PANE = process.env.TMUX_PANE

/** Cached result for isInsideTmux */
let isInsideTmuxCached: boolean | null = null

/** Cached result for isInITerm2 */
let isInITerm2Cached: boolean | null = null

/**
 * Checks if we're currently running inside a tmux session (synchronous version).
 * Uses the original TMUX value captured at module load, not process.env.TMUX,
 * because Shell.ts overrides TMUX when Claude's socket is initialized.
 *
 * IMPORTANT: We ONLY check the TMUX env var. We do NOT run `tmux display-message`
 * as a fallback because that command will succeed if ANY tmux server is running
 * on the system, not just if THIS process is inside tmux.
 */
export function isInsideTmuxSync(): boolean {
  return !!ORIGINAL_USER_TMUX
}

/**
 * Checks if we're currently running inside a tmux session.
 * Uses the original TMUX value captured at module load, not process.env.TMUX,
 * because Shell.ts overrides TMUX when Claude's socket is initialized.
 * Caches the result since this won't change during the process lifetime.
 *
 * IMPORTANT: We ONLY check the TMUX env var. We do NOT run `tmux display-message`
 * as a fallback because that command will succeed if ANY tmux server is running
 * on the system, not just if THIS process is inside tmux.
 */
export async function isInsideTmux(): Promise<boolean> {
  if (isInsideTmuxCached !== null) {
    return isInsideTmuxCached
  }

  // Check the original TMUX env var (captured at module load)
  // This tells us if the user started Claude from within their tmux session
  // If TMUX is not set, we are NOT inside tmux - period.
  isInsideTmuxCached = !!ORIGINAL_USER_TMUX
  return isInsideTmuxCached
}

/**
 * Gets the leader's tmux pane ID captured at module load.
 * Returns null if not running inside tmux.
 */
export function getLeaderPaneId(): string | null {
  return ORIGINAL_TMUX_PANE || null
}

/**
 * Checks if tmux is available on the system (installed and in PATH).
 */
export async function isTmuxAvailable(): Promise<boolean> {
  const result = await execFileNoThrow(TMUX_COMMAND, ['-V'])
  return result.code === 0
}

/**
 * Checks if we're currently running inside iTerm2.
 * Uses multiple detection methods:
 * 1. TERM_PROGRAM env var set to "iTerm.app"
 * 2. ITERM_SESSION_ID env var is present
 * 3. env.terminal detection from utils/env.ts
 *
 * Caches the result since this won't change during the process lifetime.
 *
 * Note: iTerm2 backend uses AppleScript (osascript) which is built into macOS,
 * so no external CLI tool installation is required.
 */
export function isInITerm2(): boolean {
  if (isInITerm2Cached !== null) {
    return isInITerm2Cached
  }

  // Check multiple indicators for iTerm2
  const termProgram = process.env.TERM_PROGRAM
  const hasItermSessionId = !!process.env.ITERM_SESSION_ID
  const terminalIsITerm = env.terminal === 'iTerm.app'

  isInITerm2Cached =
    termProgram === 'iTerm.app' || hasItermSessionId || terminalIsITerm

  return isInITerm2Cached
}

/**
 * The it2 CLI command name.
 */
export const IT2_COMMAND = 'it2'

/**
 * Checks if the it2 CLI tool is available AND can reach the iTerm2 Python API.
 * Uses 'session list' (not '--version') because --version succeeds even when
 * the Python API is disabled in iTerm2 preferences — which would cause
 * 'session split' to fail later with no fallback.
 */
export async function isIt2CliAvailable(): Promise<boolean> {
  const result = await execFileNoThrow(IT2_COMMAND, ['session', 'list'])
  return result.code === 0
}

/**
 * Resets all cached detection results. Used for testing.
 */
export function resetDetectionCache(): void {
  isInsideTmuxCached = null
  isInITerm2Cached = null
}
