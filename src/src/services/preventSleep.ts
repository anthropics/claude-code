/**
 * Prevents macOS from sleeping while Claude is working.
 *
 * Uses the built-in `caffeinate` command to create a power assertion that
 * prevents idle sleep. This keeps the Mac awake during API requests and
 * tool execution so long-running operations don't get interrupted.
 *
 * The caffeinate process is spawned with a timeout and periodically restarted.
 * This provides self-healing behavior: if the Node process is killed with
 * SIGKILL (which doesn't run cleanup handlers), the orphaned caffeinate will
 * automatically exit after the timeout expires.
 *
 * Only runs on macOS - no-op on other platforms.
 */
import { type ChildProcess, spawn } from 'child_process'
import { registerCleanup } from '../utils/cleanupRegistry.js'
import { logForDebugging } from '../utils/debug.js'

// Caffeinate timeout in seconds. Process auto-exits after this duration.
// We restart it before expiry to maintain continuous sleep prevention.
const CAFFEINATE_TIMEOUT_SECONDS = 300 // 5 minutes

// Restart interval - restart caffeinate before it expires.
// Use 4 minutes to give plenty of buffer before the 5 minute timeout.
const RESTART_INTERVAL_MS = 4 * 60 * 1000

let caffeinateProcess: ChildProcess | null = null
let restartInterval: ReturnType<typeof setInterval> | null = null
let refCount = 0
let cleanupRegistered = false

/**
 * Increment the reference count and start preventing sleep if needed.
 * Call this when starting work that should keep the Mac awake.
 */
export function startPreventSleep(): void {
  refCount++

  if (refCount === 1) {
    spawnCaffeinate()
    startRestartInterval()
  }
}

/**
 * Decrement the reference count and allow sleep if no more work is pending.
 * Call this when work completes.
 */
export function stopPreventSleep(): void {
  if (refCount > 0) {
    refCount--
  }

  if (refCount === 0) {
    stopRestartInterval()
    killCaffeinate()
  }
}

/**
 * Force stop preventing sleep, regardless of reference count.
 * Use this for cleanup on exit.
 */
export function forceStopPreventSleep(): void {
  refCount = 0
  stopRestartInterval()
  killCaffeinate()
}

function startRestartInterval(): void {
  // Only run on macOS
  if (process.platform !== 'darwin') {
    return
  }

  // Already running
  if (restartInterval !== null) {
    return
  }

  restartInterval = setInterval(() => {
    // Only restart if we still need sleep prevention
    if (refCount > 0) {
      logForDebugging('Restarting caffeinate to maintain sleep prevention')
      killCaffeinate()
      spawnCaffeinate()
    }
  }, RESTART_INTERVAL_MS)

  // Don't let the interval keep the Node process alive
  restartInterval.unref()
}

function stopRestartInterval(): void {
  if (restartInterval !== null) {
    clearInterval(restartInterval)
    restartInterval = null
  }
}

function spawnCaffeinate(): void {
  // Only run on macOS
  if (process.platform !== 'darwin') {
    return
  }

  // Already running
  if (caffeinateProcess !== null) {
    return
  }

  // Register cleanup on first use to ensure caffeinate is killed on exit
  if (!cleanupRegistered) {
    cleanupRegistered = true
    registerCleanup(async () => {
      forceStopPreventSleep()
    })
  }

  try {
    // -i: Create an assertion to prevent idle sleep
    //     This is the least aggressive option - display can still sleep
    // -t: Timeout in seconds - caffeinate exits automatically after this
    //     This provides self-healing if Node is killed with SIGKILL
    caffeinateProcess = spawn(
      'caffeinate',
      ['-i', '-t', String(CAFFEINATE_TIMEOUT_SECONDS)],
      {
        stdio: 'ignore',
      },
    )

    // Don't let caffeinate keep the Node process alive
    caffeinateProcess.unref()

    const thisProc = caffeinateProcess
    caffeinateProcess.on('error', err => {
      logForDebugging(`caffeinate spawn error: ${err.message}`)
      if (caffeinateProcess === thisProc) caffeinateProcess = null
    })

    caffeinateProcess.on('exit', () => {
      if (caffeinateProcess === thisProc) caffeinateProcess = null
    })

    logForDebugging('Started caffeinate to prevent sleep')
  } catch {
    // Silently fail - caffeinate not available or spawn failed
    caffeinateProcess = null
  }
}

function killCaffeinate(): void {
  if (caffeinateProcess !== null) {
    const proc = caffeinateProcess
    caffeinateProcess = null
    try {
      // SIGKILL for immediate termination - SIGTERM could be delayed
      proc.kill('SIGKILL')
      logForDebugging('Stopped caffeinate, allowing sleep')
    } catch {
      // Process may have already exited
    }
  }
}
