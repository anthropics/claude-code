import type { AgentColorName } from '../../../tools/AgentTool/agentColorManager.js'
import { logForDebugging } from '../../../utils/debug.js'
import { execFileNoThrow } from '../../../utils/execFileNoThrow.js'
import { logError } from '../../../utils/log.js'
import { count } from '../../array.js'
import { sleep } from '../../sleep.js'
import {
  getSwarmSocketName,
  HIDDEN_SESSION_NAME,
  SWARM_SESSION_NAME,
  SWARM_VIEW_WINDOW_NAME,
  TMUX_COMMAND,
} from '../constants.js'
import {
  getLeaderPaneId,
  isInsideTmux as isInsideTmuxFromDetection,
  isTmuxAvailable,
} from './detection.js'
import { registerTmuxBackend } from './registry.js'
import type { CreatePaneResult, PaneBackend, PaneId } from './types.js'

// Track whether the first pane has been used for external swarm session
let firstPaneUsedForExternal = false

// Cached leader window target (session:window format) to avoid repeated queries
let cachedLeaderWindowTarget: string | null = null

// Lock mechanism to prevent race conditions when spawning teammates in parallel
let paneCreationLock: Promise<void> = Promise.resolve()

// Delay after pane creation to allow shell initialization (loading rc files, prompts, etc.)
// 200ms is enough for most shell configurations including slow ones like starship/oh-my-zsh
const PANE_SHELL_INIT_DELAY_MS = 200

function waitForPaneShellReady(): Promise<void> {
  return sleep(PANE_SHELL_INIT_DELAY_MS)
}

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
 * Gets the tmux color name for a given agent color.
 * These are tmux's built-in color names that work with pane-border-style.
 */
function getTmuxColorName(color: AgentColorName): string {
  const tmuxColors: Record<AgentColorName, string> = {
    red: 'red',
    blue: 'blue',
    green: 'green',
    yellow: 'yellow',
    purple: 'magenta',
    orange: 'colour208',
    pink: 'colour205',
    cyan: 'cyan',
  }
  return tmuxColors[color]
}

/**
 * Runs a tmux command in the user's original tmux session (no socket override).
 * Use this for operations that interact with the user's tmux panes (split-pane with leader).
 */
function runTmuxInUserSession(
  args: string[],
): Promise<{ stdout: string; stderr: string; code: number }> {
  return execFileNoThrow(TMUX_COMMAND, args)
}

/**
 * Runs a tmux command in the external swarm socket.
 * Use this for operations in the standalone swarm session (when user is not in tmux).
 */
function runTmuxInSwarm(
  args: string[],
): Promise<{ stdout: string; stderr: string; code: number }> {
  return execFileNoThrow(TMUX_COMMAND, ['-L', getSwarmSocketName(), ...args])
}

/**
 * TmuxBackend implements PaneBackend using tmux for pane management.
 *
 * When running INSIDE tmux (leader is in tmux):
 * - Splits the current window to add teammates alongside the leader
 * - Leader stays on left (30%), teammates on right (70%)
 *
 * When running OUTSIDE tmux (leader is in regular terminal):
 * - Creates a claude-swarm session with a swarm-view window
 * - All teammates are equally distributed (no leader pane)
 */
export class TmuxBackend implements PaneBackend {
  readonly type = 'tmux' as const
  readonly displayName = 'tmux'
  readonly supportsHideShow = true

  /**
   * Checks if tmux is installed and available.
   * Delegates to detection.ts for consistent detection logic.
   */
  async isAvailable(): Promise<boolean> {
    return isTmuxAvailable()
  }

  /**
   * Checks if we're currently running inside a tmux session.
   * Delegates to detection.ts for consistent detection logic.
   */
  async isRunningInside(): Promise<boolean> {
    return isInsideTmuxFromDetection()
  }

  /**
   * Creates a new teammate pane in the swarm view.
   * Uses a lock to prevent race conditions when multiple teammates are spawned in parallel.
   */
  async createTeammatePaneInSwarmView(
    name: string,
    color: AgentColorName,
  ): Promise<CreatePaneResult> {
    const releaseLock = await acquirePaneCreationLock()

    try {
      const insideTmux = await this.isRunningInside()

      if (insideTmux) {
        return await this.createTeammatePaneWithLeader(name, color)
      }

      return await this.createTeammatePaneExternal(name, color)
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
    useExternalSession = false,
  ): Promise<void> {
    const runTmux = useExternalSession ? runTmuxInSwarm : runTmuxInUserSession
    const result = await runTmux(['send-keys', '-t', paneId, command, 'Enter'])

    if (result.code !== 0) {
      throw new Error(
        `Failed to send command to pane ${paneId}: ${result.stderr}`,
      )
    }
  }

  /**
   * Sets the border color for a specific pane.
   */
  async setPaneBorderColor(
    paneId: PaneId,
    color: AgentColorName,
    useExternalSession = false,
  ): Promise<void> {
    const tmuxColor = getTmuxColorName(color)
    const runTmux = useExternalSession ? runTmuxInSwarm : runTmuxInUserSession

    // Set pane-specific border style using pane options (requires tmux 3.2+)
    await runTmux([
      'select-pane',
      '-t',
      paneId,
      '-P',
      `bg=default,fg=${tmuxColor}`,
    ])

    await runTmux([
      'set-option',
      '-p',
      '-t',
      paneId,
      'pane-border-style',
      `fg=${tmuxColor}`,
    ])

    await runTmux([
      'set-option',
      '-p',
      '-t',
      paneId,
      'pane-active-border-style',
      `fg=${tmuxColor}`,
    ])
  }

  /**
   * Sets the title for a pane (shown in pane border if pane-border-status is set).
   */
  async setPaneTitle(
    paneId: PaneId,
    name: string,
    color: AgentColorName,
    useExternalSession = false,
  ): Promise<void> {
    const tmuxColor = getTmuxColorName(color)
    const runTmux = useExternalSession ? runTmuxInSwarm : runTmuxInUserSession

    // Set the pane title
    await runTmux(['select-pane', '-t', paneId, '-T', name])

    // Enable pane border status with colored format
    await runTmux([
      'set-option',
      '-p',
      '-t',
      paneId,
      'pane-border-format',
      `#[fg=${tmuxColor},bold] #{pane_title} #[default]`,
    ])
  }

  /**
   * Enables pane border status for a window (shows pane titles).
   */
  async enablePaneBorderStatus(
    windowTarget?: string,
    useExternalSession = false,
  ): Promise<void> {
    const target = windowTarget || (await this.getCurrentWindowTarget())
    if (!target) {
      return
    }

    const runTmux = useExternalSession ? runTmuxInSwarm : runTmuxInUserSession
    await runTmux([
      'set-option',
      '-w',
      '-t',
      target,
      'pane-border-status',
      'top',
    ])
  }

  /**
   * Rebalances panes to achieve the desired layout.
   */
  async rebalancePanes(
    windowTarget: string,
    hasLeader: boolean,
  ): Promise<void> {
    if (hasLeader) {
      await this.rebalancePanesWithLeader(windowTarget)
    } else {
      await this.rebalancePanesTiled(windowTarget)
    }
  }

  /**
   * Kills/closes a specific pane.
   */
  async killPane(paneId: PaneId, useExternalSession = false): Promise<boolean> {
    const runTmux = useExternalSession ? runTmuxInSwarm : runTmuxInUserSession
    const result = await runTmux(['kill-pane', '-t', paneId])
    return result.code === 0
  }

  /**
   * Hides a pane by moving it to a detached hidden session.
   * Creates the hidden session if it doesn't exist, then uses break-pane to move the pane there.
   */
  async hidePane(paneId: PaneId, useExternalSession = false): Promise<boolean> {
    const runTmux = useExternalSession ? runTmuxInSwarm : runTmuxInUserSession

    // Create hidden session if it doesn't exist (detached, not visible)
    await runTmux(['new-session', '-d', '-s', HIDDEN_SESSION_NAME])

    // Move the pane to the hidden session
    const result = await runTmux([
      'break-pane',
      '-d',
      '-s',
      paneId,
      '-t',
      `${HIDDEN_SESSION_NAME}:`,
    ])

    if (result.code === 0) {
      logForDebugging(`[TmuxBackend] Hidden pane ${paneId}`)
    } else {
      logForDebugging(
        `[TmuxBackend] Failed to hide pane ${paneId}: ${result.stderr}`,
      )
    }

    return result.code === 0
  }

  /**
   * Shows a previously hidden pane by joining it back into the target window.
   * Uses `tmux join-pane` to move the pane back, then reapplies main-vertical layout
   * with leader at 30%.
   */
  async showPane(
    paneId: PaneId,
    targetWindowOrPane: string,
    useExternalSession = false,
  ): Promise<boolean> {
    const runTmux = useExternalSession ? runTmuxInSwarm : runTmuxInUserSession

    // join-pane -s: source pane to move
    // -t: target window/pane to join into
    // -h: join horizontally (side by side)
    const result = await runTmux([
      'join-pane',
      '-h',
      '-s',
      paneId,
      '-t',
      targetWindowOrPane,
    ])

    if (result.code !== 0) {
      logForDebugging(
        `[TmuxBackend] Failed to show pane ${paneId}: ${result.stderr}`,
      )
      return false
    }

    logForDebugging(
      `[TmuxBackend] Showed pane ${paneId} in ${targetWindowOrPane}`,
    )

    // Reapply main-vertical layout with leader at 30%
    await runTmux(['select-layout', '-t', targetWindowOrPane, 'main-vertical'])

    // Get the first pane (leader) and resize to 30%
    const panesResult = await runTmux([
      'list-panes',
      '-t',
      targetWindowOrPane,
      '-F',
      '#{pane_id}',
    ])

    const panes = panesResult.stdout.trim().split('\n').filter(Boolean)
    if (panes[0]) {
      await runTmux(['resize-pane', '-t', panes[0], '-x', '30%'])
    }

    return true
  }

  // Private helper methods

  /**
   * Gets the leader's pane ID.
   * Uses the TMUX_PANE env var captured at module load to ensure we always
   * get the leader's original pane, even if the user has switched panes.
   */
  private async getCurrentPaneId(): Promise<string | null> {
    // Use the pane ID captured at startup (from TMUX_PANE env var)
    const leaderPane = getLeaderPaneId()
    if (leaderPane) {
      return leaderPane
    }

    // Fallback to dynamic query (shouldn't happen if we're inside tmux)
    const result = await execFileNoThrow(TMUX_COMMAND, [
      'display-message',
      '-p',
      '#{pane_id}',
    ])

    if (result.code !== 0) {
      logForDebugging(
        `[TmuxBackend] Failed to get current pane ID (exit ${result.code}): ${result.stderr}`,
      )
      return null
    }

    return result.stdout.trim()
  }

  /**
   * Gets the leader's window target (session:window format).
   * Uses the leader's pane ID to query for its window, ensuring we get the
   * correct window even if the user has switched to a different window.
   * Caches the result since the leader's window won't change.
   */
  private async getCurrentWindowTarget(): Promise<string | null> {
    // Return cached value if available
    if (cachedLeaderWindowTarget) {
      return cachedLeaderWindowTarget
    }

    // Build the command - use -t to target the leader's pane specifically
    const leaderPane = getLeaderPaneId()
    const args = ['display-message']
    if (leaderPane) {
      args.push('-t', leaderPane)
    }
    args.push('-p', '#{session_name}:#{window_index}')

    const result = await execFileNoThrow(TMUX_COMMAND, args)

    if (result.code !== 0) {
      logForDebugging(
        `[TmuxBackend] Failed to get current window target (exit ${result.code}): ${result.stderr}`,
      )
      return null
    }

    cachedLeaderWindowTarget = result.stdout.trim()
    return cachedLeaderWindowTarget
  }

  /**
   * Gets the number of panes in a window.
   */
  private async getCurrentWindowPaneCount(
    windowTarget?: string,
    useSwarmSocket = false,
  ): Promise<number | null> {
    const target = windowTarget || (await this.getCurrentWindowTarget())
    if (!target) {
      return null
    }

    const args = ['list-panes', '-t', target, '-F', '#{pane_id}']
    const result = useSwarmSocket
      ? await runTmuxInSwarm(args)
      : await runTmuxInUserSession(args)

    if (result.code !== 0) {
      logError(
        new Error(
          `[TmuxBackend] Failed to get pane count for ${target} (exit ${result.code}): ${result.stderr}`,
        ),
      )
      return null
    }

    return count(result.stdout.trim().split('\n'), Boolean)
  }

  /**
   * Checks if a tmux session exists in the swarm socket.
   */
  private async hasSessionInSwarm(sessionName: string): Promise<boolean> {
    const result = await runTmuxInSwarm(['has-session', '-t', sessionName])
    return result.code === 0
  }

  /**
   * Creates the swarm session with a single window for teammates when running outside tmux.
   */
  private async createExternalSwarmSession(): Promise<{
    windowTarget: string
    paneId: string
  }> {
    const sessionExists = await this.hasSessionInSwarm(SWARM_SESSION_NAME)

    if (!sessionExists) {
      const result = await runTmuxInSwarm([
        'new-session',
        '-d',
        '-s',
        SWARM_SESSION_NAME,
        '-n',
        SWARM_VIEW_WINDOW_NAME,
        '-P',
        '-F',
        '#{pane_id}',
      ])

      if (result.code !== 0) {
        throw new Error(
          `Failed to create swarm session: ${result.stderr || 'Unknown error'}`,
        )
      }

      const paneId = result.stdout.trim()
      const windowTarget = `${SWARM_SESSION_NAME}:${SWARM_VIEW_WINDOW_NAME}`

      logForDebugging(
        `[TmuxBackend] Created external swarm session with window ${windowTarget}, pane ${paneId}`,
      )

      return { windowTarget, paneId }
    }

    // Session exists, check if swarm-view window exists
    const listResult = await runTmuxInSwarm([
      'list-windows',
      '-t',
      SWARM_SESSION_NAME,
      '-F',
      '#{window_name}',
    ])

    const windows = listResult.stdout.trim().split('\n').filter(Boolean)
    const windowTarget = `${SWARM_SESSION_NAME}:${SWARM_VIEW_WINDOW_NAME}`

    if (windows.includes(SWARM_VIEW_WINDOW_NAME)) {
      const paneResult = await runTmuxInSwarm([
        'list-panes',
        '-t',
        windowTarget,
        '-F',
        '#{pane_id}',
      ])

      const panes = paneResult.stdout.trim().split('\n').filter(Boolean)
      return { windowTarget, paneId: panes[0] || '' }
    }

    // Create the swarm-view window
    const createResult = await runTmuxInSwarm([
      'new-window',
      '-t',
      SWARM_SESSION_NAME,
      '-n',
      SWARM_VIEW_WINDOW_NAME,
      '-P',
      '-F',
      '#{pane_id}',
    ])

    if (createResult.code !== 0) {
      throw new Error(
        `Failed to create swarm-view window: ${createResult.stderr || 'Unknown error'}`,
      )
    }

    return { windowTarget, paneId: createResult.stdout.trim() }
  }

  /**
   * Creates a teammate pane when running inside tmux (with leader).
   */
  private async createTeammatePaneWithLeader(
    teammateName: string,
    teammateColor: AgentColorName,
  ): Promise<CreatePaneResult> {
    const currentPaneId = await this.getCurrentPaneId()
    const windowTarget = await this.getCurrentWindowTarget()

    if (!currentPaneId || !windowTarget) {
      throw new Error('Could not determine current tmux pane/window')
    }

    const paneCount = await this.getCurrentWindowPaneCount(windowTarget)
    if (paneCount === null) {
      throw new Error('Could not determine pane count for current window')
    }
    const isFirstTeammate = paneCount === 1

    let splitResult
    if (isFirstTeammate) {
      // First teammate: split horizontally from the leader pane
      splitResult = await execFileNoThrow(TMUX_COMMAND, [
        'split-window',
        '-t',
        currentPaneId,
        '-h',
        '-l',
        '70%',
        '-P',
        '-F',
        '#{pane_id}',
      ])
    } else {
      // Additional teammates: split from an existing teammate pane
      const listResult = await execFileNoThrow(TMUX_COMMAND, [
        'list-panes',
        '-t',
        windowTarget,
        '-F',
        '#{pane_id}',
      ])

      const panes = listResult.stdout.trim().split('\n').filter(Boolean)
      const teammatePanes = panes.slice(1)
      const teammateCount = teammatePanes.length

      const splitVertically = teammateCount % 2 === 1
      const targetPaneIndex = Math.floor((teammateCount - 1) / 2)
      const targetPane =
        teammatePanes[targetPaneIndex] ||
        teammatePanes[teammatePanes.length - 1]

      splitResult = await execFileNoThrow(TMUX_COMMAND, [
        'split-window',
        '-t',
        targetPane!,
        splitVertically ? '-v' : '-h',
        '-P',
        '-F',
        '#{pane_id}',
      ])
    }

    if (splitResult.code !== 0) {
      throw new Error(`Failed to create teammate pane: ${splitResult.stderr}`)
    }

    const paneId = splitResult.stdout.trim()
    logForDebugging(
      `[TmuxBackend] Created teammate pane for ${teammateName}: ${paneId}`,
    )

    await this.setPaneBorderColor(paneId, teammateColor)
    await this.setPaneTitle(paneId, teammateName, teammateColor)
    await this.rebalancePanesWithLeader(windowTarget)

    // Wait for shell to initialize before returning, so commands can be sent immediately
    await waitForPaneShellReady()

    return { paneId, isFirstTeammate }
  }

  /**
   * Creates a teammate pane when running outside tmux (no leader in tmux).
   */
  private async createTeammatePaneExternal(
    teammateName: string,
    teammateColor: AgentColorName,
  ): Promise<CreatePaneResult> {
    const { windowTarget, paneId: firstPaneId } =
      await this.createExternalSwarmSession()

    const paneCount = await this.getCurrentWindowPaneCount(windowTarget, true)
    if (paneCount === null) {
      throw new Error('Could not determine pane count for swarm window')
    }
    const isFirstTeammate = !firstPaneUsedForExternal && paneCount === 1

    let paneId: string

    if (isFirstTeammate) {
      paneId = firstPaneId
      firstPaneUsedForExternal = true
      logForDebugging(
        `[TmuxBackend] Using initial pane for first teammate ${teammateName}: ${paneId}`,
      )

      await this.enablePaneBorderStatus(windowTarget, true)
    } else {
      const listResult = await runTmuxInSwarm([
        'list-panes',
        '-t',
        windowTarget,
        '-F',
        '#{pane_id}',
      ])

      const panes = listResult.stdout.trim().split('\n').filter(Boolean)
      const teammateCount = panes.length

      const splitVertically = teammateCount % 2 === 1
      const targetPaneIndex = Math.floor((teammateCount - 1) / 2)
      const targetPane = panes[targetPaneIndex] || panes[panes.length - 1]

      const splitResult = await runTmuxInSwarm([
        'split-window',
        '-t',
        targetPane!,
        splitVertically ? '-v' : '-h',
        '-P',
        '-F',
        '#{pane_id}',
      ])

      if (splitResult.code !== 0) {
        throw new Error(`Failed to create teammate pane: ${splitResult.stderr}`)
      }

      paneId = splitResult.stdout.trim()
      logForDebugging(
        `[TmuxBackend] Created teammate pane for ${teammateName}: ${paneId}`,
      )
    }

    await this.setPaneBorderColor(paneId, teammateColor, true)
    await this.setPaneTitle(paneId, teammateName, teammateColor, true)
    await this.rebalancePanesTiled(windowTarget)

    // Wait for shell to initialize before returning, so commands can be sent immediately
    await waitForPaneShellReady()

    return { paneId, isFirstTeammate }
  }

  /**
   * Rebalances panes in a window with a leader.
   */
  private async rebalancePanesWithLeader(windowTarget: string): Promise<void> {
    const listResult = await runTmuxInUserSession([
      'list-panes',
      '-t',
      windowTarget,
      '-F',
      '#{pane_id}',
    ])

    const panes = listResult.stdout.trim().split('\n').filter(Boolean)
    if (panes.length <= 2) {
      return
    }

    await runTmuxInUserSession([
      'select-layout',
      '-t',
      windowTarget,
      'main-vertical',
    ])

    const leaderPane = panes[0]
    await runTmuxInUserSession(['resize-pane', '-t', leaderPane!, '-x', '30%'])

    logForDebugging(
      `[TmuxBackend] Rebalanced ${panes.length - 1} teammate panes with leader`,
    )
  }

  /**
   * Rebalances panes in a window without a leader (tiled layout).
   */
  private async rebalancePanesTiled(windowTarget: string): Promise<void> {
    const listResult = await runTmuxInSwarm([
      'list-panes',
      '-t',
      windowTarget,
      '-F',
      '#{pane_id}',
    ])

    const panes = listResult.stdout.trim().split('\n').filter(Boolean)
    if (panes.length <= 1) {
      return
    }

    await runTmuxInSwarm(['select-layout', '-t', windowTarget, 'tiled'])

    logForDebugging(
      `[TmuxBackend] Rebalanced ${panes.length} teammate panes with tiled layout`,
    )
  }
}

// Register the backend with the registry when this module is imported.
// This side effect is intentional - the registry needs backends to self-register to avoid circular dependencies.
// eslint-disable-next-line custom-rules/no-top-level-side-effects
registerTmuxBackend(TmuxBackend)
