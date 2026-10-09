/**
 * Session activity tracking with refcount-based heartbeat timer.
 *
 * The transport registers its keep-alive sender via registerSessionActivityCallback().
 * Callers (API streaming, tool execution) bracket their work with
 * startSessionActivity() / stopSessionActivity(). When the refcount is >0 a
 * periodic timer fires the registered callback every 30 seconds to keep the
 * container alive.
 *
 * Sending keep-alives is gated behind CLAUDE_CODE_REMOTE_SEND_KEEPALIVES.
 * Diagnostic logging always fires to help diagnose idle gaps.
 */

import { registerCleanup } from './cleanupRegistry.js'
import { logForDiagnosticsNoPII } from './diagLogs.js'
import { isEnvTruthy } from './envUtils.js'

const SESSION_ACTIVITY_INTERVAL_MS = 30_000

export type SessionActivityReason = 'api_call' | 'tool_exec'

let activityCallback: (() => void) | null = null
let refcount = 0
const activeReasons = new Map<SessionActivityReason, number>()
let oldestActivityStartedAt: number | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let idleTimer: ReturnType<typeof setTimeout> | null = null
let cleanupRegistered = false

function startHeartbeatTimer(): void {
  clearIdleTimer()
  heartbeatTimer = setInterval(() => {
    logForDiagnosticsNoPII('debug', 'session_keepalive_heartbeat', {
      refcount,
    })
    if (isEnvTruthy(process.env.CLAUDE_CODE_REMOTE_SEND_KEEPALIVES)) {
      activityCallback?.()
    }
  }, SESSION_ACTIVITY_INTERVAL_MS)
}

function startIdleTimer(): void {
  clearIdleTimer()
  if (activityCallback === null) {
    return
  }
  idleTimer = setTimeout(() => {
    logForDiagnosticsNoPII('info', 'session_idle_30s')
    idleTimer = null
  }, SESSION_ACTIVITY_INTERVAL_MS)
}

function clearIdleTimer(): void {
  if (idleTimer !== null) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
}

export function registerSessionActivityCallback(cb: () => void): void {
  activityCallback = cb
  // Restart timer if work is already in progress (e.g. reconnect during streaming)
  if (refcount > 0 && heartbeatTimer === null) {
    startHeartbeatTimer()
  }
}

export function unregisterSessionActivityCallback(): void {
  activityCallback = null
  // Stop timer if the callback is removed
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
  clearIdleTimer()
}

export function sendSessionActivitySignal(): void {
  if (isEnvTruthy(process.env.CLAUDE_CODE_REMOTE_SEND_KEEPALIVES)) {
    activityCallback?.()
  }
}

export function isSessionActivityTrackingActive(): boolean {
  return activityCallback !== null
}

/**
 * Increment the activity refcount. When it transitions from 0→1 and a callback
 * is registered, start a periodic heartbeat timer.
 */
export function startSessionActivity(reason: SessionActivityReason): void {
  refcount++
  activeReasons.set(reason, (activeReasons.get(reason) ?? 0) + 1)
  if (refcount === 1) {
    oldestActivityStartedAt = Date.now()
    if (activityCallback !== null && heartbeatTimer === null) {
      startHeartbeatTimer()
    }
  }
  if (!cleanupRegistered) {
    cleanupRegistered = true
    registerCleanup(async () => {
      logForDiagnosticsNoPII('info', 'session_activity_at_shutdown', {
        refcount,
        active: Object.fromEntries(activeReasons),
        // Only meaningful while work is in-flight; stale otherwise.
        oldest_activity_ms:
          refcount > 0 && oldestActivityStartedAt !== null
            ? Date.now() - oldestActivityStartedAt
            : null,
      })
    })
  }
}

/**
 * Decrement the activity refcount. When it reaches 0, stop the heartbeat timer
 * and start an idle timer that logs after 30s of inactivity.
 */
export function stopSessionActivity(reason: SessionActivityReason): void {
  if (refcount > 0) {
    refcount--
  }
  const n = (activeReasons.get(reason) ?? 0) - 1
  if (n > 0) activeReasons.set(reason, n)
  else activeReasons.delete(reason)
  if (refcount === 0 && heartbeatTimer !== null) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
    startIdleTimer()
  }
}
