import chalk from 'chalk'
import { writeSync } from 'fs'
import memoize from 'lodash-es/memoize.js'
import { onExit } from 'signal-exit'
import type { ExitReason } from 'src/entrypoints/agentSdkTypes.js'
import {
  getIsInteractive,
  getIsScrollDraining,
  getLastMainRequestId,
  getSessionId,
  isSessionPersistenceDisabled,
} from '../bootstrap/state.js'
import instances from '../ink/instances.js'
import {
  DISABLE_KITTY_KEYBOARD,
  DISABLE_MODIFY_OTHER_KEYS,
} from '../ink/termio/csi.js'
import {
  DBP,
  DFE,
  DISABLE_MOUSE_TRACKING,
  EXIT_ALT_SCREEN,
  SHOW_CURSOR,
} from '../ink/termio/dec.js'
import {
  CLEAR_ITERM2_PROGRESS,
  CLEAR_TAB_STATUS,
  CLEAR_TERMINAL_TITLE,
  supportsTabStatus,
  wrapForMultiplexer,
} from '../ink/termio/osc.js'
import { shutdownDatadog } from '../services/analytics/datadog.js'
import { shutdown1PEventLogging } from '../services/analytics/firstPartyEventLogger.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../services/analytics/index.js'
import type { AppState } from '../state/AppState.js'
import { runCleanupFunctions } from './cleanupRegistry.js'
import { logForDebugging } from './debug.js'
import { logForDiagnosticsNoPII } from './diagLogs.js'
import { isEnvTruthy } from './envUtils.js'
import { getCurrentSessionTitle, sessionIdExists } from './sessionStorage.js'
import { sleep } from './sleep.js'
import { profileReport } from './startupProfiler.js'

/**
 * Clean up terminal modes synchronously before process exit.
 * This ensures terminal escape sequences (Kitty keyboard, focus reporting, etc.)
 * are properly disabled even if React's componentWillUnmount doesn't run in time.
 * Uses writeSync to ensure writes complete before exit.
 *
 * We unconditionally send all disable sequences because:
 * 1. Terminal detection may not always work correctly (e.g., in tmux, screen)
 * 2. These sequences are no-ops on terminals that don't support them
 * 3. Failing to disable leaves the terminal in a broken state
 */
/* eslint-disable custom-rules/no-sync-fs -- must be sync to flush before process.exit */
function cleanupTerminalModes(): void {
  if (!process.stdout.isTTY) {
    return
  }

  try {
    // Disable mouse tracking FIRST, before the React unmount tree-walk.
    // The terminal needs a round-trip to process this and stop sending
    // events; doing it now (not after unmount) gives that time while
    // we're busy unmounting. Otherwise events arrive during cooked-mode
    // cleanup and either echo to the screen or leak to the shell.
    writeSync(1, DISABLE_MOUSE_TRACKING)
    // Exit alt screen FIRST so printResumeHint() (and all sequences below)
    // land on the main buffer.
    //
    // Unmount Ink directly rather than writing EXIT_ALT_SCREEN ourselves.
    // Ink registered its unmount with signal-exit, so it will otherwise run
    // AGAIN inside forceExit() → process.exit(). Two problems with letting
    // that happen:
    //   1. If we write 1049l here and unmount writes it again later, the
    //      second one triggers another DECRC — the cursor jumps back over
    //      the resume hint and the shell prompt lands on the wrong line.
    //   2. unmount()'s onRender() must run with altScreenActive=true (alt-
    //      screen cursor math) AND on the alt buffer. Exiting alt-screen
    //      here first makes onRender() scribble a REPL frame onto main.
    // Calling unmount() now does the final render on the alt buffer,
    // unsubscribes from signal-exit, and writes 1049l exactly once.
    const inst = instances.get(process.stdout)
    if (inst?.isAltScreenActive) {
      try {
        inst.unmount()
      } catch {
        // Reconciler/render threw — fall back to manual alt-screen exit
        // so printResumeHint still hits the main buffer.
        writeSync(1, EXIT_ALT_SCREEN)
      }
    }
    // Catches events that arrived during the unmount tree-walk.
    // detachForShutdown() below also drains.
    inst?.drainStdin()
    // Mark the Ink instance unmounted so signal-exit's deferred ink.unmount()
    // early-returns instead of sending redundant EXIT_ALT_SCREEN sequences
    // (from its writeSync cleanup block + AlternateScreen's unmount cleanup).
    // Those redundant sequences land AFTER printResumeHint() and clobber the
    // resume hint on tmux (and possibly other terminals) by restoring the
    // saved cursor position. Safe to skip full unmount: this function already
    // sends all the terminal-reset sequences, and the process is exiting.
    inst?.detachForShutdown()
    // Disable extended key reporting — always send both since terminals
    // silently ignore whichever they don't implement
    writeSync(1, DISABLE_MODIFY_OTHER_KEYS)
    writeSync(1, DISABLE_KITTY_KEYBOARD)
    // Disable focus events (DECSET 1004)
    writeSync(1, DFE)
    // Disable bracketed paste mode
    writeSync(1, DBP)
    // Show cursor
    writeSync(1, SHOW_CURSOR)
    // Clear iTerm2 progress bar - prevents lingering progress indicator
    // that can cause bell sounds when returning to the terminal tab
    writeSync(1, CLEAR_ITERM2_PROGRESS)
    // Clear tab status (OSC 21337) so a stale dot doesn't linger
    if (supportsTabStatus()) writeSync(1, wrapForMultiplexer(CLEAR_TAB_STATUS))
    // Clear terminal title so the tab doesn't show stale session info.
    // Respect CLAUDE_CODE_DISABLE_TERMINAL_TITLE — if the user opted out of
    // title changes, don't clear their existing title on exit either.
    if (!isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_TERMINAL_TITLE)) {
      if (process.platform === 'win32') {
        process.title = ''
      } else {
        writeSync(1, CLEAR_TERMINAL_TITLE)
      }
    }
  } catch {
    // Terminal may already be gone (e.g., SIGHUP after terminal close).
    // Ignore write errors since we're exiting anyway.
  }
}

let resumeHintPrinted = false

/**
 * Print a hint about how to resume the session.
 * Only shown for interactive sessions with persistence enabled.
 */
function printResumeHint(): void {
  // Only print once (failsafe timer may call this again after normal shutdown)
  if (resumeHintPrinted) {
    return
  }
  // Only show with TTY, interactive sessions, and persistence
  if (
    process.stdout.isTTY &&
    getIsInteractive() &&
    !isSessionPersistenceDisabled()
  ) {
    try {
      const sessionId = getSessionId()
      // Don't show resume hint if no session file exists (e.g., subcommands like `claude update`)
      if (!sessionIdExists(sessionId)) {
        return
      }
      const customTitle = getCurrentSessionTitle(sessionId)

      // Use custom title if available, otherwise fall back to session ID
      let resumeArg: string
      if (customTitle) {
        // Wrap in double quotes, escape backslashes first then quotes
        const escaped = customTitle.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
        resumeArg = `"${escaped}"`
      } else {
        resumeArg = sessionId
      }

      writeSync(
        1,
        chalk.dim(
          `\nResume this session with:\nclaude --resume ${resumeArg}\n`,
        ),
      )
      resumeHintPrinted = true
    } catch {
      // Ignore write errors
    }
  }
}
/* eslint-enable custom-rules/no-sync-fs */

/**
 * Force process exit, handling the case where the terminal is gone.
 * When the terminal/PTY is closed (e.g., SIGHUP), process.exit() can throw
 * EIO errors because Bun tries to flush stdout to a dead file descriptor.
 * In that case, fall back to SIGKILL which always works.
 */
function forceExit(exitCode: number): never {
  // Clear failsafe timer since we're exiting now
  if (failsafeTimer !== undefined) {
    clearTimeout(failsafeTimer)
    failsafeTimer = undefined
  }
  // Drain stdin LAST, right before exit. cleanupTerminalModes() sent
  // DISABLE_MOUSE_TRACKING early, but the terminal round-trip plus any
  // events already in flight means bytes can arrive during the seconds
  // of async cleanup between then and now. Draining here catches them.
  // Use the Ink class method (not the standalone drainStdin()) so we
  // drain the instance's stdin — when process.stdin is piped,
  // getStdinOverride() opens /dev/tty as the real input stream and the
  // class method knows about it; the standalone function defaults to
  // process.stdin which would early-return on isTTY=false.
  try {
    instances.get(process.stdout)?.drainStdin()
  } catch {
    // Terminal may be gone (SIGHUP). Ignore — we are about to exit.
  }
  try {
    process.exit(exitCode)
  } catch (e) {
    // process.exit() threw. In tests, it's mocked to throw - re-throw so test sees it.
    // In production, it's likely EIO from dead terminal - use SIGKILL.
    if ((process.env.NODE_ENV as string) === 'test') {
      throw e
    }
    // Fall back to SIGKILL which doesn't try to flush anything.
    process.kill(process.pid, 'SIGKILL')
  }
  // In tests, process.exit may be mocked to return instead of exiting.
  // In production, we should never reach here.
  if ((process.env.NODE_ENV as string) !== 'test') {
    throw new Error('unreachable')
  }
  // TypeScript trick: cast to never since we know this only happens in tests
  // where the mock returns instead of exiting
  return undefined as never
}

/**
 * Set up global signal handlers for graceful shutdown
 */
export const setupGracefulShutdown = memoize(() => {
  // Work around a Bun bug where process.removeListener(sig, fn) resets the
  // kernel sigaction for that signal even when other JS listeners remain —
  // the signal then falls back to its default action (terminate) and our
  // process.on('SIGTERM') handler never runs.
  //
  // Trigger: any short-lived signal-exit v4 subscriber (e.g. execa per child
  // process, or an Ink instance that unmounts). When its unsubscribe runs and
  // it was the last v4 subscriber, v4.unload() calls removeListener on every
  // signal in its list (SIGTERM, SIGINT, SIGHUP, …), tripping the Bun bug and
  // nuking our handlers at the kernel level.
  //
  // Fix: pin signal-exit v4 loaded by registering a no-op onExit callback that
  // is never unsubscribed. This keeps v4's internal emitter count > 0 so
  // unload() never runs and removeListener is never called. Harmless under
  // Node.js — the pin also ensures signal-exit's process.exit hook stays
  // active for Ink cleanup.
  onExit(() => {})

  process.on('SIGINT', () => {
    // In print mode, print.ts registers its own SIGINT handler that aborts
    // the in-flight query and calls gracefulShutdown(0); skip here to
    // avoid racing with it. Only check print mode — other non-interactive
    // sessions (--sdk-url, --init-only, non-TTY) don't register their own
    // SIGINT handler and need gracefulShutdown to run.
    if (process.argv.includes('-p') || process.argv.includes('--print')) {
      return
    }
    logForDiagnosticsNoPII('info', 'shutdown_signal', { signal: 'SIGINT' })
    void gracefulShutdown(0)
  })
  process.on('SIGTERM', () => {
    logForDiagnosticsNoPII('info', 'shutdown_signal', { signal: 'SIGTERM' })
    void gracefulShutdown(143) // Exit code 143 (128 + 15) for SIGTERM
  })
  if (process.platform !== 'win32') {
    process.on('SIGHUP', () => {
      logForDiagnosticsNoPII('info', 'shutdown_signal', { signal: 'SIGHUP' })
      void gracefulShutdown(129) // Exit code 129 (128 + 1) for SIGHUP
    })

    // Detect orphaned process when terminal closes without delivering SIGHUP.
    // macOS revokes TTY file descriptors instead of signaling, leaving the
    // process alive but unable to read/write. Periodically check stdin validity.
    if (process.stdin.isTTY) {
      orphanCheckInterval = setInterval(() => {
        // Skip during scroll drain — even a cheap check consumes an event
        // loop tick that scroll frames need. 30s interval → missing one is fine.
        if (getIsScrollDraining()) return
        // process.stdout.writable becomes false when the TTY is revoked
        if (!process.stdout.writable || !process.stdin.readable) {
          clearInterval(orphanCheckInterval)
          logForDiagnosticsNoPII('info', 'shutdown_signal', {
            signal: 'orphan_detected',
          })
          void gracefulShutdown(129)
        }
      }, 30_000) // Check every 30 seconds
      orphanCheckInterval.unref() // Don't keep process alive just for this check
    }
  }

  // Log uncaught exceptions for container observability and analytics
  // Error names (e.g., "TypeError") are not sensitive - safe to log
  process.on('uncaughtException', error => {
    logForDiagnosticsNoPII('error', 'uncaught_exception', {
      error_name: error.name,
      error_message: error.message.slice(0, 2000),
    })
    logEvent('tengu_uncaught_exception', {
      error_name:
        error.name as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
  })

  // Log unhandled promise rejections for container observability and analytics
  process.on('unhandledRejection', reason => {
    const errorName =
      reason instanceof Error
        ? reason.name
        : typeof reason === 'string'
          ? 'string'
          : 'unknown'
    const errorInfo =
      reason instanceof Error
        ? {
            error_name: reason.name,
            error_message: reason.message.slice(0, 2000),
            error_stack: reason.stack?.slice(0, 4000),
          }
        : { error_message: String(reason).slice(0, 2000) }
    logForDiagnosticsNoPII('error', 'unhandled_rejection', errorInfo)
    logEvent('tengu_unhandled_rejection', {
      error_name:
        errorName as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
  })
})

export function gracefulShutdownSync(
  exitCode = 0,
  reason: ExitReason = 'other',
  options?: {
    getAppState?: () => AppState
    setAppState?: (f: (prev: AppState) => AppState) => void
  },
): void {
  // Set the exit code that will be used when process naturally exits. Note that we do it
  // here inside the sync version too so that it is possible to determine if
  // gracefulShutdownSync was called by checking process.exitCode.
  process.exitCode = exitCode

  pendingShutdown = gracefulShutdown(exitCode, reason, options)
    .catch(error => {
      logForDebugging(`Graceful shutdown failed: ${error}`, { level: 'error' })
      cleanupTerminalModes()
      printResumeHint()
      forceExit(exitCode)
    })
    // Prevent unhandled rejection: forceExit re-throws in test mode,
    // which would escape the .catch() handler above as a new rejection.
    .catch(() => {})
}

let shutdownInProgress = false
let failsafeTimer: ReturnType<typeof setTimeout> | undefined
let orphanCheckInterval: ReturnType<typeof setInterval> | undefined
let pendingShutdown: Promise<void> | undefined

/** Check if graceful shutdown is in progress */
export function isShuttingDown(): boolean {
  return shutdownInProgress
}

/** Reset shutdown state - only for use in tests */
export function resetShutdownState(): void {
  shutdownInProgress = false
  resumeHintPrinted = false
  if (failsafeTimer !== undefined) {
    clearTimeout(failsafeTimer)
    failsafeTimer = undefined
  }
  pendingShutdown = undefined
}

/**
 * Returns the in-flight shutdown promise, if any. Only for use in tests
 * to await completion before restoring mocks.
 */
export function getPendingShutdownForTesting(): Promise<void> | undefined {
  return pendingShutdown
}

// Graceful shutdown function that drains the event loop
export async function gracefulShutdown(
  exitCode = 0,
  reason: ExitReason = 'other',
  options?: {
    getAppState?: () => AppState
    setAppState?: (f: (prev: AppState) => AppState) => void
    /** Printed to stderr after alt-screen exit, before forceExit. */
    finalMessage?: string
  },
): Promise<void> {
  if (shutdownInProgress) {
    return
  }
  shutdownInProgress = true

  // Resolve the SessionEnd hook budget before arming the failsafe so the
  // failsafe can scale with it. Without this, a user-configured 10s hook
  // budget is silently truncated by the 5s failsafe (gh-32712 follow-up).
  const { executeSessionEndHooks, getSessionEndHookTimeoutMs } = await import(
    './hooks.js'
  )
  const sessionEndTimeoutMs = getSessionEndHookTimeoutMs()

  // Failsafe: guarantee process exits even if cleanup hangs (e.g., MCP connections).
  // Runs cleanupTerminalModes first so a hung cleanup doesn't leave the terminal dirty.
  // Budget = max(5s, hook budget + 3.5s headroom for cleanup + analytics flush).
  failsafeTimer = setTimeout(
    code => {
      cleanupTerminalModes()
      printResumeHint()
      forceExit(code)
    },
    Math.max(5000, sessionEndTimeoutMs + 3500),
    exitCode,
  )
  failsafeTimer.unref()

  // Set the exit code that will be used when process naturally exits
  process.exitCode = exitCode

  // Exit alt screen and print resume hint FIRST, before any async operations.
  // This ensures the hint is visible even if the process is killed during
  // cleanup (e.g., SIGKILL during macOS reboot). Without this, the resume
  // hint would only appear after cleanup functions, hooks, and analytics
  // flush — which can take several seconds.
  cleanupTerminalModes()
  printResumeHint()

  // Flush session data first — this is the most critical cleanup. If the
  // terminal is dead (SIGHUP, SSH disconnect), hooks and analytics may hang
  // on I/O to a dead TTY or unreachable network, eating into the
  // failsafe budget. Session persistence must complete before anything else.
  let cleanupTimeoutId: ReturnType<typeof setTimeout> | undefined
  try {
    const cleanupPromise = (async () => {
      try {
        await runCleanupFunctions()
      } catch {
        // Silently ignore cleanup errors
      }
    })()

    await Promise.race([
      cleanupPromise,
      new Promise((_, reject) => {
        cleanupTimeoutId = setTimeout(
          rej => rej(new CleanupTimeoutError()),
          2000,
          reject,
        )
      }),
    ])
    clearTimeout(cleanupTimeoutId)
  } catch {
    // Silently handle timeout and other errors
    clearTimeout(cleanupTimeoutId)
  }

  // Execute SessionEnd hooks. Bound both the per-hook default timeout and the
  // overall execution via a single budget (CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS,
  // default 1.5s). hook.timeout in settings is respected up to this cap.
  try {
    await executeSessionEndHooks(reason, {
      ...options,
      signal: AbortSignal.timeout(sessionEndTimeoutMs),
      timeoutMs: sessionEndTimeoutMs,
    })
  } catch {
    // Ignore SessionEnd hook exceptions (including AbortError on timeout)
  }

  // Log startup perf before analytics shutdown flushes/cancels timers
  try {
    profileReport()
  } catch {
    // Ignore profiling errors during shutdown
  }

  // Signal to inference that this session's cache can be evicted.
  // Fires before analytics flush so the event makes it to the pipeline.
  const lastRequestId = getLastMainRequestId()
  if (lastRequestId) {
    logEvent('tengu_cache_eviction_hint', {
      scope:
        'session_end' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      last_request_id:
        lastRequestId as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
  }

  // Flush analytics — capped at 500ms. Previously unbounded: the 1P exporter
  // awaits all pending axios POSTs (10s each), eating the full failsafe budget.
  // Lost analytics on slow networks are acceptable; a hanging exit is not.
  try {
    await Promise.race([
      Promise.all([shutdown1PEventLogging(), shutdownDatadog()]),
      sleep(500),
    ])
  } catch {
    // Ignore analytics shutdown errors
  }

  if (options?.finalMessage) {
    try {
      // eslint-disable-next-line custom-rules/no-sync-fs -- must flush before forceExit
      writeSync(2, options.finalMessage + '\n')
    } catch {
      // stderr may be closed (e.g., SSH disconnect). Ignore write errors.
    }
  }

  forceExit(exitCode)
}

class CleanupTimeoutError extends Error {
  constructor() {
    super('Cleanup timeout')
  }
}
