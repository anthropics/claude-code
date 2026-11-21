import type { AgentColorName } from '../../../tools/AgentTool/agentColorManager.js'
import { logForDebugging } from '../../../utils/debug.js'
import { execFileNoThrow } from '../../../utils/execFileNoThrow.js'
import { IT2_COMMAND, isInITerm2, isIt2CliAvailable } from './detection.js'
import { registerITermBackend } from './registry.js'
import type { CreatePaneResult, PaneBackend, PaneId } from './types.js'

// Track session IDs for teammates
const teammateSessionIds: string[] = []

// Track whether the first pane has been used
let firstPaneUsed = false

// Lock mechanism to prevent race conditions when spawning teammates in parallel
let paneCreationLock: Promise<void> = Promise.resolve()

/**
 * Acquires a lock for pane creation, ensuring sequential execution.
 * Returns a release function that must be called when done.
 */
function acquirePaneCreationLock(): Promise<() => void> {
  let release: () => void
  const newLock = new Promise<void>(resolve => {
    release = resolve
  })

  const previousLock = paneCreationLock
  paneCreationLock = newLock

  return previousLock.then(() => release!)
}

/**
 * Runs an it2 CLI command and returns the result.
 */
function runIt2(
  args: string[],
): Promise<{ stdout: string; stderr: string; code: number }> {
  return execFileNoThrow(IT2_COMMAND, args)
}

/**
 * Parses the session ID from `it2 session split` output.
 * Format: "Created new pane: <session-id>"
 *
 * NOTE: This UUID is only valid when splitting from a specific session
 * using the -s flag. When splitting from the "active" session, the UUID
 * may not be accessible if the split happened in a different window.
 */
function parseSplitOutput(output: string): string {
  const match = output.match(/Created new pane:\s*(.+)/)
  if (match && match[1]) {
    return match[1].trim()
  }
  return ''
}

/**
 * Gets the leader's session ID from ITERM_SESSION_ID env var.
 * Format: "wXtYpZ:UUID" - we extract the UUID part after the colon.
 * Returns null if not in iTerm2 or env var not set.
 */
function getLeaderSessionId(): string | null {
  const itermSessionId = process.env.ITERM_SESSION_ID
  if (!itermSessionId) {
    return null
  }
  const colonIndex = itermSessionId.indexOf(':')
  if (colonIndex === -1) {
    return null
  }
  return itermSessionId.slice(colonIndex + 1)
}

/**
 * ITermBackend implements pane management using iTerm2's native split panes
 * via the it2 CLI tool.
 */
export class ITermBackend implements PaneBackend {
  readonly type = 'iterm2' as const
  readonly displayName = 'iTerm2'
  readonly supportsHideShow = false

  /**
   * Checks if iTerm2 backend is available (in iTerm2 with it2 CLI installed).
   */
  async isAvailable(): Promise<boolean> {
    const inITerm2 = isInITerm2()
    logForDebugging(`[ITermBackend] isAvailable check: inITerm2=${inITerm2}`)
    if (!inITerm2) {
      logForDebugging('[ITermBackend] isAvailable: false (not in iTerm2)')
      return false
    }
    const it2Available = await isIt2CliAvailable()
    logForDebugging(
      `[ITermBackend] isAvailable: ${it2Available} (it2 CLI ${it2Available ? 'found' : 'not found'})`,
    )
    return it2Available
  }

  /**
   * Checks if we're currently running inside iTerm2.
   */
  async isRunningInside(): Promise<boolean> {
    const result = isInITerm2()
    logForDebugging(`[ITermBackend] isRunningInside: ${result}`)
    return result
  }

  /**
   * Creates a new teammate pane in the swarm view.
   * Uses a lock to prevent race conditions when multiple teammates are spawned in parallel.
   */
  async createTeammatePaneInSwarmView(
    name: string,
    color: AgentColorName,
  ): Promise<CreatePaneResult> {
    logForDebugging(
      `[ITermBackend] createTeammatePaneInSwarmView called for ${name} with color ${color}`,
    )
    const releaseLock = await acquirePaneCreationLock()

    try {
      // Layout: Leader on left, teammates stacked vertically on the right
      // - First teammate: vertical split (-v) from leader's session
      // - Subsequent teammates: horizontal split from last teammate's session
      //
      // We explicitly target the session to split from using -s flag to ensure
      // correct layout even if user clicks on different panes.
      //
      // At-fault recovery: If a targeted teammate session is dead (user closed
      // the pane via Cmd+W / X, or process crashed), prune it and retry with
      // the next-to-last. Cheaper than a proactive 'it2 session list' on every spawn.
      // Bounded at O(N+1) iterations: each continue shrinks teammateSessionIds by 1;
      // when empty → firstPaneUsed resets → next iteration has no target → throws.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const isFirstTeammate = !firstPaneUsed
        logForDebugging(
          `[ITermBackend] Creating pane: isFirstTeammate=${isFirstTeammate}, existingPanes=${teammateSessionIds.length}`,
        )

        let splitArgs: string[]
        let targetedTeammateId: string | undefined
        if (isFirstTeammate) {
          // Split from leader's session (extracted from ITERM_SESSION_ID env var)
          const leaderSessionId = getLeaderSessionId()
          if (leaderSessionId) {
            splitArgs = ['session', 'split', '-v', '-s', leaderSessionId]
            logForDebugging(
              `[ITermBackend] First split from leader session: ${leaderSessionId}`,
            )
          } else {
            // Fallback to active session if we can't get leader's ID
            splitArgs = ['session', 'split', '-v']
            logForDebugging(
              '[ITermBackend] First split from active session (no leader ID)',
            )
          }
        } else {
          // Split from the last teammate's session to stack vertically
          targetedTeammateId = teammateSessionIds[teammateSessionIds.length - 1]
          if (targetedTeammateId) {
            splitArgs = ['session', 'split', '-s', targetedTeammateId]
            logForDebugging(
              `[ITermBackend] Subsequent split from teammate session: ${targetedTeammateId}`,
            )
          } else {
            // Fallback to active session
            splitArgs = ['session', 'split']
            logForDebugging(
              '[ITermBackend] Subsequent split from active session (no teammate ID)',
            )
          }
        }

        const splitResult = await runIt2(splitArgs)

        if (splitResult.code !== 0) {
          // If we targeted a teammate session, confirm it's actually dead before
          // pruning — 'session list' distinguishes dead-target from systemic
          // failure (Python API off, it2 removed, transient socket error).
          // Pruning on systemic failure would drain all live IDs → state corrupted.
          if (targetedTeammateId) {
            const listResult = await runIt2(['session', 'list'])
            if (
              listResult.code === 0 &&
              !listResult.stdout.includes(targetedTeammateId)
            ) {
              // Confirmed dead — prune and retry with next-to-last (or leader).
              logForDebugging(
                `[ITermBackend] Split failed targeting dead session ${targetedTeammateId}, pruning and retrying: ${splitResult.stderr}`,
              )
              const idx = teammateSessionIds.indexOf(targetedTeammateId)
              if (idx !== -1) {
                teammateSessionIds.splice(idx, 1)
              }
              if (teammateSessionIds.length === 0) {
                firstPaneUsed = false
              }
              continue
            }
            // Target is alive or we can't tell — don't corrupt state, surface the error.
          }
          throw new Error(
            `Failed to create iTerm2 split pane: ${splitResult.stderr}`,
          )
        }

        if (isFirstTeammate) {
          firstPaneUsed = true
        }

        // Parse the session ID from split output
        // This works because we're splitting from a specific session (-s flag),
        // so the new pane is in the same window and the UUID is valid.
        const paneId = parseSplitOutput(splitResult.stdout)

        if (!paneId) {
          throw new Error(
            `Failed to parse session ID from split output: ${splitResult.stdout}`,
          )
        }
        logForDebugging(
          `[ITermBackend] Created teammate pane for ${name}: ${paneId}`,
        )

        teammateSessionIds.push(paneId)

        // Set pane color and title
        // Skip color and title for now - each it2 call is slow (Python process + API)
        // The pane is functional without these cosmetic features
        // TODO: Consider batching these or making them async/fire-and-forget

        return { paneId, isFirstTeammate }
      }
    } finally {
      releaseLock()
    }
  }

  /**
   * Sends a command to a specific pane.
   */
  async sendCommandToPane(
    paneId: PaneId,
    command: string,
    _useExternalSession?: boolean,
  ): Promise<void> {
    // Use it2 session run to execute command (adds newline automatically)
    // Always use -s flag to target specific session - this ensures the command
    // goes to the right pane even if user switches windows
    const args = paneId
      ? ['session', 'run', '-s', paneId, command]
      : ['session', 'run', command]

    const result = await runIt2(args)

    if (result.code !== 0) {
      throw new Error(
        `Failed to send command to iTerm2 pane ${paneId}: ${result.stderr}`,
      )
    }
  }

  /**
   * No-op for iTerm2 - tab colors would require escape sequences but we skip
   * them for performance (each it2 call is slow).
   */
  async setPaneBorderColor(
    _paneId: PaneId,
    _color: AgentColorName,
    _useExternalSession?: boolean,
  ): Promise<void> {
    // Skip for performance - each it2 call spawns a Python process
  }

  /**
   * No-op for iTerm2 - titles would require escape sequences but we skip
   * them for performance (each it2 call is slow).
   */
  async setPaneTitle(
    _paneId: PaneId,
    _name: string,
    _color: AgentColorName,
    _useExternalSession?: boolean,
  ): Promise<void> {
    // Skip for performance - each it2 call spawns a Python process
  }

  /**
   * No-op for iTerm2 - pane titles are shown in tabs automatically.
   */
  async enablePaneBorderStatus(
    _windowTarget?: string,
    _useExternalSession?: boolean,
  ): Promise<void> {
    // iTerm2 doesn't have the concept of pane border status like tmux
    // Titles are shown in tabs automatically
  }

  /**
   * No-op for iTerm2 - pane balancing is handled automatically.
   */
  async rebalancePanes(
    _windowTarget: string,
    _hasLeader: boolean,
  ): Promise<void> {
    // iTerm2 handles pane balancing automatically
    logForDebugging(
      '[ITermBackend] Pane rebalancing not implemented for iTerm2',
    )
  }

  /**
   * Kills/closes a specific pane using the it2 CLI.
   * Also removes the pane from tracked session IDs so subsequent spawns
   * don't try to split from a dead session.
   */
  async killPane(
    paneId: PaneId,
    _useExternalSession?: boolean,
  ): Promise<boolean> {
    // -f (force) is required: without it, iTerm2 respects the "Confirm before
    // closing" preference and either shows a dialog or refuses when the session
    // still has a running process (the shell always is). tmux kill-pane has no
    // such prompt, which is why this was only broken for iTerm2.
    const result = await runIt2(['session', 'close', '-f', '-s', paneId])
    // Clean up module state regardless of close result — even if the pane is
    // already gone (e.g., user closed it manually), removing the stale ID is correct.
    const idx = teammateSessionIds.indexOf(paneId)
    if (idx !== -1) {
      teammateSessionIds.splice(idx, 1)
    }
    if (teammateSessionIds.length === 0) {
      firstPaneUsed = false
    }
    return result.code === 0
  }

  /**
   * Stub for hiding a pane - not supported in iTerm2 backend.
   * iTerm2 doesn't have a direct equivalent to tmux's break-pane.
   */
  async hidePane(
    _paneId: PaneId,
    _useExternalSession?: boolean,
  ): Promise<boolean> {
    logForDebugging('[ITermBackend] hidePane not supported in iTerm2')
    return false
  }

  /**
   * Stub for showing a hidden pane - not supported in iTerm2 backend.
   * iTerm2 doesn't have a direct equivalent to tmux's join-pane.
   */
  async showPane(
    _paneId: PaneId,
    _targetWindowOrPane: string,
    _useExternalSession?: boolean,
  ): Promise<boolean> {
    logForDebugging('[ITermBackend] showPane not supported in iTerm2')
    return false
  }
}

// Register the backend with the registry when this module is imported.
// This side effect is intentional - the registry needs backends to self-register to avoid circular dependencies.
// eslint-disable-next-line custom-rules/no-top-level-side-effects
registerITermBackend(ITermBackend)
