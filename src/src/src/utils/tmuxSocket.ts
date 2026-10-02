/**
 * TMUX SOCKET ISOLATION
 * =====================
 * This module manages an isolated tmux socket for Claude's operations.
 *
 * WHY THIS EXISTS:
 * Without isolation, Claude could accidentally affect the user's tmux sessions.
 * For example, running `tmux kill-session` via the Bash tool would kill the
 * user's current session if they started Claude from within tmux.
 *
 * HOW IT WORKS:
 * 1. Claude creates its own tmux socket: `claude-<PID>` (e.g., `claude-12345`)
 * 2. ALL Tmux tool commands use this socket via the `-L` flag
 * 3. ALL Bash tool commands inherit TMUX env var pointing to this socket
 *    (set in Shell.ts via getClaudeTmuxEnv())
 *
 * This means ANY tmux command run through Claude - whether via the Tmux tool
 * directly or via Bash - will operate on Claude's isolated socket, NOT the
 * user's tmux session.
 *
 * IMPORTANT: The user's original TMUX env var is NOT used. After socket
 * initialization, getClaudeTmuxEnv() returns a value that overrides the
 * user's TMUX in all child processes spawned by Shell.ts.
 */

import { posix } from 'path'
import { registerCleanup } from './cleanupRegistry.js'
import { logForDebugging } from './debug.js'
import { toError } from './errors.js'
import { execFileNoThrow } from './execFileNoThrow.js'
import { logError } from './log.js'
import { getPlatform } from './platform.js'

// Constants for tmux socket management
const TMUX_COMMAND = 'tmux'
const CLAUDE_SOCKET_PREFIX = 'claude'

/**
 * Executes a tmux command, routing through WSL on Windows.
 * On Windows, tmux only exists inside WSL — WSL interop lets the tmux session
 * launch .exe files as native Win32 processes while stdin/stdout flow through
 * the WSL pty.
 */
async function execTmux(
  args: string[],
  opts?: { useCwd?: boolean },
): Promise<{ stdout: string; stderr: string; code: number }> {
  if (getPlatform() === 'windows') {
    // -e execs tmux directly without the login shell. Without it, wsl hands the
    // command line to bash which eats `#` as a comment: `display-message -p
    // #{socket_path},#{pid}` below becomes `display-message -p ` → exit 1 →
    // we silently fall back to the guessed path and never learn the real
    // server PID. Same root cause as TungstenTool/utils.ts:execTmuxCommand.
    const result = await execFileNoThrow('wsl', ['-e', TMUX_COMMAND, ...args], {
      env: { ...process.env, WSL_UTF8: '1' },
      ...opts,
    })
    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      code: result.code || 0,
    }
  }
  const result = await execFileNoThrow(TMUX_COMMAND, args, opts)
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    code: result.code || 0,
  }
}

// Socket state - initialized lazily when Tmux tool is first used or a tmux command is run
let socketName: string | null = null
let socketPath: string | null = null
let serverPid: number | null = null
let isInitializing = false
let initPromise: Promise<void> | null = null

// tmux availability - checked once upfront
let tmuxAvailabilityChecked = false
let tmuxAvailable = false

// Track whether the Tmux tool has been used at least once
// Used to defer socket initialization until actually needed
let tmuxToolUsed = false

/**
 * Gets the socket name for Claude's isolated tmux session.
 * Format: claude-<PID>
 */
export function getClaudeSocketName(): string {
  if (!socketName) {
    socketName = `${CLAUDE_SOCKET_PREFIX}-${process.pid}`
  }
  return socketName
}

/**
 * Gets the socket path if the socket has been initialized.
 * Returns null if not yet initialized.
 */
export function getClaudeSocketPath(): string | null {
  return socketPath
}

/**
 * Sets socket info after initialization.
 * Called after the tmux session is created.
 */
export function setClaudeSocketInfo(path: string, pid: number): void {
  socketPath = path
  serverPid = pid
}

/**
 * Returns whether the socket has been initialized.
 */
export function isSocketInitialized(): boolean {
  return socketPath !== null && serverPid !== null
}

/**
 * Gets the TMUX environment variable value for Claude's isolated socket.
 *
 * CRITICAL: This value is used by Shell.ts to override the TMUX env var
 * in ALL child processes. This ensures that any `tmux` command run via
 * the Bash tool will operate on Claude's socket, NOT the user's session.
 *
 * Format: "socket_path,server_pid,pane_index" (matches tmux's TMUX env var)
 * Example: "/tmp/tmux-501/claude-12345,54321,0"
 *
 * Returns null if socket is not yet initialized.
 * When null, Shell.ts does not override TMUX, preserving user's environment.
 */
export function getClaudeTmuxEnv(): string | null {
  if (!socketPath || serverPid === null) {
    return null
  }
  return `${socketPath},${serverPid},0`
}

/**
 * Checks if tmux is available on this system.
 * This is checked once and cached for the lifetime of the process.
 *
 * When tmux is not available:
 * - TungstenTool (Tmux) will not work
 * - TeammateTool will not work (it uses tmux for pane management)
 * - Bash commands will run without tmux isolation
 */
export async function checkTmuxAvailable(): Promise<boolean> {
  if (!tmuxAvailabilityChecked) {
    const result =
      getPlatform() === 'windows'
        ? await execFileNoThrow('wsl', ['-e', TMUX_COMMAND, '-V'], {
            env: { ...process.env, WSL_UTF8: '1' },
            useCwd: false,
          })
        : await execFileNoThrow('which', [TMUX_COMMAND], {
            useCwd: false,
          })
    tmuxAvailable = result.code === 0
    if (!tmuxAvailable) {
      logForDebugging(
        `[Socket] tmux is not installed. The Tmux tool and Teammate tool will not be available.`,
      )
    }
    tmuxAvailabilityChecked = true
  }
  return tmuxAvailable
}

/**
 * Returns the cached tmux availability status.
 * Returns false if availability hasn't been checked yet.
 * Use checkTmuxAvailable() to perform the check.
 */
export function isTmuxAvailable(): boolean {
  return tmuxAvailabilityChecked && tmuxAvailable
}

/**
 * Marks that the Tmux tool has been used at least once.
 * Called by TungstenTool before initialization.
 * After this is called, Shell.ts will initialize the socket for subsequent Bash commands.
 */
export function markTmuxToolUsed(): void {
  tmuxToolUsed = true
}

/**
 * Returns whether the Tmux tool has been used at least once.
 * Used by Shell.ts to decide whether to initialize the socket.
 */
export function hasTmuxToolBeenUsed(): boolean {
  return tmuxToolUsed
}

/**
 * Ensures the socket is initialized with a tmux session.
 * Called by Shell.ts when the Tmux tool has been used or the command includes "tmux".
 * Safe to call multiple times; will only initialize once.
 *
 * If tmux is not installed, this function returns gracefully without
 * initializing the socket. getClaudeTmuxEnv() will return null, and
 * Bash commands will run without tmux isolation.
 */
export async function ensureSocketInitialized(): Promise<void> {
  // Already initialized
  if (isSocketInitialized()) {
    return
  }

  // Check if tmux is available before trying to use it
  const available = await checkTmuxAvailable()
  if (!available) {
    return
  }

  // Another call is already initializing - wait for it but don't propagate errors
  // The original caller handles the error and sets up graceful degradation
  if (isInitializing && initPromise) {
    try {
      await initPromise
    } catch {
      // Ignore - the original caller logs the error
    }
    return
  }

  isInitializing = true
  initPromise = doInitialize()

  try {
    await initPromise
  } catch (error) {
    // Log error but don't throw - graceful degradation
    const err = toError(error)
    logError(err)
    logForDebugging(
      `[Socket] Failed to initialize tmux socket: ${err.message}. Tmux isolation will be disabled.`,
    )
  } finally {
    isInitializing = false
  }
}

/**
 * Kills the tmux server for Claude's isolated socket.
 * Called during graceful shutdown to clean up resources.
 */
async function killTmuxServer(): Promise<void> {
  const socket = getClaudeSocketName()
  logForDebugging(`[Socket] Killing tmux server for socket: ${socket}`)

  const result = await execTmux(['-L', socket, 'kill-server'])

  if (result.code === 0) {
    logForDebugging(`[Socket] Successfully killed tmux server`)
  } else {
    // Server may already be dead, which is fine
    logForDebugging(
      `[Socket] Failed to kill tmux server (exit ${result.code}): ${result.stderr}`,
    )
  }
}

async function doInitialize(): Promise<void> {
  const socket = getClaudeSocketName()

  // Create a new session with our custom socket
  // Pass CLAUDE_CODE_SKIP_PROMPT_HISTORY via -e so it's set in the initial shell environment
  //
  // On Windows, the tmux server inherits WSL_INTEROP from the short-lived
  // wsl.exe that spawns it; once `new-session -d` detaches and wsl.exe exits,
  // that socket stops servicing requests. Any cli.exe launched inside the pane
  // then hits `UtilAcceptVsock: accept4 failed 110` (ETIMEDOUT). Observed on
  // 2026-03-25: server PID 386 (started alongside /init at WSL boot) inherited
  // /run/WSL/383_interop — init's own socket, which listens but doesn't handle
  // interop. /run/WSL/1_interop is a stable symlink WSL maintains to the real
  // handler; pin the server to it so interop survives the spawning wsl.exe.
  const result = await execTmux([
    '-L',
    socket,
    'new-session',
    '-d',
    '-s',
    'base',
    '-e',
    'CLAUDE_CODE_SKIP_PROMPT_HISTORY=true',
    ...(getPlatform() === 'windows'
      ? ['-e', 'WSL_INTEROP=/run/WSL/1_interop']
      : []),
  ])

  if (result.code !== 0) {
    // Session might already exist from a previous run with same PID (unlikely but possible)
    // Check if the session exists
    const checkResult = await execTmux([
      '-L',
      socket,
      'has-session',
      '-t',
      'base',
    ])
    if (checkResult.code !== 0) {
      throw new Error(
        `Failed to create tmux session on socket ${socket}: ${result.stderr}`,
      )
    }
  }

  // Register cleanup to kill the tmux server on exit
  registerCleanup(killTmuxServer)

  // Set CLAUDE_CODE_SKIP_PROMPT_HISTORY in the tmux GLOBAL environment (-g).
  // Without -g this would only apply to the 'base' session, and new sessions
  // created by TungstenTool (e.g. 'test', 'verify') would not inherit it.
  // Any Claude Code instance spawned on this socket will inherit this env var,
  // preventing test/verification sessions from polluting the user's real
  // command history and --resume session list.
  await execTmux([
    '-L',
    socket,
    'set-environment',
    '-g',
    'CLAUDE_CODE_SKIP_PROMPT_HISTORY',
    'true',
  ])

  // Same WSL_INTEROP pin as the new-session -e above, but in the GLOBAL env
  // so sessions created by TungstenTool inherit it too. The -e on new-session
  // only covers the base session's initial shell; a later `new-session -s cc`
  // inherits the SERVER's env, which still holds the stale socket from the
  // wsl.exe that spawned it.
  if (getPlatform() === 'windows') {
    await execTmux([
      '-L',
      socket,
      'set-environment',
      '-g',
      'WSL_INTEROP',
      '/run/WSL/1_interop',
    ])
  }

  // Get the socket path and server PID
  const infoResult = await execTmux([
    '-L',
    socket,
    'display-message',
    '-p',
    '#{socket_path},#{pid}',
  ])

  if (infoResult.code === 0) {
    const [path, pidStr] = infoResult.stdout.trim().split(',')
    if (path && pidStr) {
      const pid = parseInt(pidStr, 10)
      if (!isNaN(pid)) {
        setClaudeSocketInfo(path, pid)
        return
      }
    }
    // Parsing failed - log and fall through to fallback
    logForDebugging(
      `[Socket] Failed to parse socket info from tmux output: "${infoResult.stdout.trim()}". Using fallback path.`,
    )
  } else {
    // Command failed - log and fall through to fallback
    logForDebugging(
      `[Socket] Failed to get socket info via display-message (exit ${infoResult.code}): ${infoResult.stderr}. Using fallback path.`,
    )
  }

  // Fallback: construct the socket path from standard tmux location
  // tmux sockets are typically at $TMPDIR/tmux-<UID>/<socket_name> (or /tmp/tmux-<UID>/ if TMPDIR is not set)
  // On Windows this path is inside WSL, so always use POSIX separators.
  // process.getuid() is undefined on Windows; WSL default user is root (uid 0) in CI.
  const uid = process.getuid?.() ?? 0
  const baseTmpDir = process.env.TMPDIR || '/tmp'
  const fallbackPath = posix.join(baseTmpDir, `tmux-${uid}`, socket)

  // Get server PID separately
  const pidResult = await execTmux([
    '-L',
    socket,
    'display-message',
    '-p',
    '#{pid}',
  ])

  if (pidResult.code === 0) {
    const pid = parseInt(pidResult.stdout.trim(), 10)
    if (!isNaN(pid)) {
      logForDebugging(
        `[Socket] Using fallback socket path: ${fallbackPath} (server PID: ${pid})`,
      )
      setClaudeSocketInfo(fallbackPath, pid)
      return
    }
    // PID parsing failed
    logForDebugging(
      `[Socket] Failed to parse server PID from tmux output: "${pidResult.stdout.trim()}"`,
    )
  } else {
    logForDebugging(
      `[Socket] Failed to get server PID (exit ${pidResult.code}): ${pidResult.stderr}`,
    )
  }

  throw new Error(
    `Failed to get socket info for ${socket}: primary="${infoResult.stderr}", fallback="${pidResult.stderr}"`,
  )
}

// For testing purposes
export function resetSocketState(): void {
  socketName = null
  socketPath = null
  serverPid = null
  isInitializing = false
  initPromise = null
  tmuxAvailabilityChecked = false
  tmuxAvailable = false
  tmuxToolUsed = false
}
