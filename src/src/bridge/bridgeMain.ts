import { feature } from 'bun:bundle'
import { randomUUID } from 'crypto'
import { hostname, tmpdir } from 'os'
import { basename, join, resolve } from 'path'
import { getRemoteSessionUrl } from '../constants/product.js'
import { shutdownDatadog } from '../services/analytics/datadog.js'
import { shutdown1PEventLogging } from '../services/analytics/firstPartyEventLogger.js'
import { checkGate_CACHED_OR_BLOCKING } from '../services/analytics/growthbook.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
  logEventAsync,
} from '../services/analytics/index.js'
import { isInBundledMode } from '../utils/bundledMode.js'
import { logForDebugging } from '../utils/debug.js'
import { logForDiagnosticsNoPII } from '../utils/diagLogs.js'
import { isEnvTruthy, isInProtectedNamespace } from '../utils/envUtils.js'
import { errorMessage } from '../utils/errors.js'
import { truncateToWidth } from '../utils/format.js'
import { logError } from '../utils/log.js'
import { sleep } from '../utils/sleep.js'
import { createAgentWorktree, removeAgentWorktree } from '../utils/worktree.js'
import {
  BridgeFatalError,
  createBridgeApiClient,
  isExpiredErrorType,
  isSuppressible403,
  validateBridgeId,
} from './bridgeApi.js'
import { formatDuration } from './bridgeStatusUtil.js'
import { createBridgeLogger } from './bridgeUI.js'
import { createCapacityWake } from './capacityWake.js'
import { describeAxiosError } from './debugUtils.js'
import { createTokenRefreshScheduler } from './jwtUtils.js'
import { getPollIntervalConfig } from './pollConfig.js'
import { toCompatSessionId, toInfraSessionId } from './sessionIdCompat.js'
import { createSessionSpawner, safeFilenameId } from './sessionRunner.js'
import { getTrustedDeviceToken } from './trustedDevice.js'
import {
  BRIDGE_LOGIN_ERROR,
  type BridgeApiClient,
  type BridgeConfig,
  type BridgeLogger,
  DEFAULT_SESSION_TIMEOUT_MS,
  type SessionDoneStatus,
  type SessionHandle,
  type SessionSpawner,
  type SessionSpawnOpts,
  type SpawnMode,
} from './types.js'
import {
  buildCCRv2SdkUrl,
  buildSdkUrl,
  decodeWorkSecret,
  registerWorker,
  sameSessionId,
} from './workSecret.js'

export type BackoffConfig = {
  connInitialMs: number
  connCapMs: number
  connGiveUpMs: number
  generalInitialMs: number
  generalCapMs: number
  generalGiveUpMs: number
  /** SIGTERM→SIGKILL grace period on shutdown. Default 30s. */
  shutdownGraceMs?: number
  /** stopWorkWithRetry base delay (1s/2s/4s backoff). Default 1000ms. */
  stopWorkBaseDelayMs?: number
}

const DEFAULT_BACKOFF: BackoffConfig = {
  connInitialMs: 2_000,
  connCapMs: 120_000, // 2 minutes
  connGiveUpMs: 600_000, // 10 minutes
  generalInitialMs: 500,
  generalCapMs: 30_000,
  generalGiveUpMs: 600_000, // 10 minutes
}

/** Status update interval for the live display (ms). */
const STATUS_UPDATE_INTERVAL_MS = 1_000
const SPAWN_SESSIONS_DEFAULT = 32

/**
 * GrowthBook gate for multi-session spawn modes (--spawn / --capacity / --create-session-in-dir).
 * Sibling of tengu_ccr_bridge_multi_environment (multiple envs per host:dir) —
 * this one enables multiple sessions per environment.
 * Rollout staged via targeting rules: ants first, then gradual external.
 *
 * Uses the blocking gate check so a stale disk-cache miss doesn't unfairly
 * deny access. The fast path (cache has true) is still instant; only the
 * cold-start path awaits the server fetch, and that fetch also seeds the
 * disk cache for next time.
 */
async function isMultiSessionSpawnEnabled(): Promise<boolean> {
  return checkGate_CACHED_OR_BLOCKING('tengu_ccr_bridge_multi_session')
}

/**
 * Returns the threshold for detecting system sleep/wake in the poll loop.
 * Must exceed the max backoff cap — otherwise normal backoff delays trigger
 * false sleep detection (resetting the error budget indefinitely). Using
 * 2× the connection backoff cap, matching the pattern in WebSocketTransport
 * and replBridge.
 */
function pollSleepDetectionThresholdMs(backoff: BackoffConfig): number {
  return backoff.connCapMs * 2
}

/**
 * Returns the args that must precede CLI flags when spawning a child claude
 * process. In compiled binaries, process.execPath is the claude binary itself
 * and args go directly to it. In npm installs (node running cli.js),
 * process.execPath is the node runtime — the child spawn must pass the script
 * path as the first arg, otherwise node interprets --sdk-url as a node option
 * and exits with "bad option: --sdk-url". See anthropics/claude-code#28334.
 */
function spawnScriptArgs(): string[] {
  if (isInBundledMode() || !process.argv[1]) {
    return []
  }
  return [process.argv[1]]
}

/** Attempt to spawn a session; returns error string if spawn throws. */
function safeSpawn(
  spawner: SessionSpawner,
  opts: SessionSpawnOpts,
  dir: string,
): SessionHandle | string {
  try {
    return spawner.spawn(opts, dir)
  } catch (err) {
    const errMsg = errorMessage(err)
    logError(new Error(`Session spawn failed: ${errMsg}`))
    return errMsg
  }
}

export async function runBridgeLoop(
  config: BridgeConfig,
  environmentId: string,
  environmentSecret: string,
  api: BridgeApiClient,
  spawner: SessionSpawner,
  logger: BridgeLogger,
  signal: AbortSignal,
  backoffConfig: BackoffConfig = DEFAULT_BACKOFF,
  initialSessionId?: string,
  getAccessToken?: () => string | undefined | Promise<string | undefined>,
): Promise<void> {
  // Local abort controller so that onSessionDone can stop the poll loop.
  // Linked to the incoming signal so external aborts also work.
  const controller = new AbortController()
  if (signal.aborted) {
    controller.abort()
  } else {
    signal.addEventListener('abort', () => controller.abort(), { once: true })
  }
  const loopSignal = controller.signal

  const activeSessions = new Map<string, SessionHandle>()
  const sessionStartTimes = new Map<string, number>()
  const sessionWorkIds = new Map<string, string>()
  // Compat-surface ID (session_*) computed once at spawn and cached so
  // cleanup and status-update ticks use the same key regardless of whether
  // the tengu_bridge_repl_v2_cse_shim_enabled gate flips mid-session.
  const sessionCompatIds = new Map<string, string>()
  // Session ingress JWTs for heartbeat auth, keyed by sessionId.
  // Stored separately from handle.accessToken because the token refresh
  // scheduler overwrites that field with the OAuth token (~3h55m in).
  const sessionIngressTokens = new Map<string, string>()
  const sessionTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const completedWorkIds = new Set<string>()
  const sessionWorktrees = new Map<
    string,
    {
      worktreePath: string
      worktreeBranch?: string
      gitRoot?: string
      hookBased?: boolean
    }
  >()
  // Track sessions killed by the timeout watchdog so onSessionDone can
  // distinguish them from server-initiated or shutdown interrupts.
  const timedOutSessions = new Set<string>()
  // Sessions that already have a title (server-set or bridge-derived) so
  // onFirstUserMessage doesn't clobber a user-assigned --name / web rename.
  // Keyed by compatSessionId to match logger.setSessionTitle's key.
  const titledSessions = new Set<string>()
  // Signal to wake the at-capacity sleep early when a session completes,
  // so the bridge can immediately accept new work.
  const capacityWake = createCapacityWake(loopSignal)

  /**
   * Heartbeat all active work items.
   * Returns 'ok' if at least one heartbeat succeeded, 'auth_failed' if any
   * got a 401/403 (JWT expired — re-queued via reconnectSession so the next
   * poll delivers fresh work), or 'failed' if all failed for other reasons.
   */
  async function heartbeatActiveWorkItems(): Promise<
    'ok' | 'auth_failed' | 'fatal' | 'failed'
  > {
    let anySuccess = false
    let anyFatal = false
    const authFailedSessions: string[] = []
    for (const [sessionId] of activeSessions) {
      const workId = sessionWorkIds.get(sessionId)
      const ingressToken = sessionIngressTokens.get(sessionId)
      if (!workId || !ingressToken) {
        continue
      }
      try {
        await api.heartbeatWork(environmentId, workId, ingressToken)
        anySuccess = true
      } catch (err) {
        logForDebugging(
          `[bridge:heartbeat] Failed for sessionId=${sessionId} workId=${workId}: ${errorMessage(err)}`,
        )
        if (err instanceof BridgeFatalError) {
          logEvent('tengu_bridge_heartbeat_error', {
            status:
              err.status as unknown as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
            error_type: (err.status === 401 || err.status === 403
              ? 'auth_failed'
              : 'fatal') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          })
          if (err.status === 401 || err.status === 403) {
            authFailedSessions.push(sessionId)
          } else {
            // 404/410 = environment expired or deleted — no point retrying
            anyFatal = true
          }
        }
      }
    }
    // JWT expired → trigger server-side re-dispatch. Without this, work stays
    // ACK'd out of the Redis PEL and poll returns empty forever (CC-1263).
    // The existingHandle path below delivers the fresh token to the child.
    // sessionId is already in the format /bridge/reconnect expects: it comes
    // from work.data.id, which matches the server's EnvironmentInstance store
    // (cse_* under the compat gate, session_* otherwise).
    for (const sessionId of authFailedSessions) {
      logger.logVerbose(
        `Session ${sessionId} token expired — re-queuing via bridge/reconnect`,
      )
      try {
        await api.reconnectSession(environmentId, sessionId)
        logForDebugging(
          `[bridge:heartbeat] Re-queued sessionId=${sessionId} via bridge/reconnect`,
        )
      } catch (err) {
        logger.logError(
          `Failed to refresh session ${sessionId} token: ${errorMessage(err)}`,
        )
        logForDebugging(
          `[bridge:heartbeat] reconnectSession(${sessionId}) failed: ${errorMessage(err)}`,
          { level: 'error' },
        )
      }
    }
    if (anyFatal) {
      return 'fatal'
    }
    if (authFailedSessions.length > 0) {
      return 'auth_failed'
    }
    return anySuccess ? 'ok' : 'failed'
  }

  // Sessions spawned with CCR v2 env vars. v2 children cannot use OAuth
  // tokens (CCR worker endpoints validate the JWT's session_id claim,
  // register_worker.go:32), so onRefresh triggers server re-dispatch
  // instead — the next poll delivers fresh work with a new JWT via the
  // existingHandle path below.
  const v2Sessions = new Set<string>()

  // Proactive token refresh: schedules a timer 5min before the session
  // ingress JWT expires. v1 delivers OAuth directly; v2 calls
  // reconnectSession to trigger server re-dispatch (CC-1263: without
  // this, v2 daemon sessions silently die at ~5h since the server does
  // not auto-re-dispatch ACK'd work on lease expiry).
  const tokenRefresh = getAccessToken
    ? createTokenRefreshScheduler({
        getAccessToken,
        onRefresh: (sessionId, oauthToken) => {
          const handle = activeSessions.get(sessionId)
          if (!handle) {
            return
          }
          if (v2Sessions.has(sessionId)) {
            logger.logVerbose(
              `Refreshing session ${sessionId} token via bridge/reconnect`,
            )
            void api
              .reconnectSession(environmentId, sessionId)
              .catch((err: unknown) => {
                logger.logError(
                  `Failed to refresh session ${sessionId} token: ${errorMessage(err)}`,
                )
                logForDebugging(
                  `[bridge:token] reconnectSession(${sessionId}) failed: ${errorMessage(err)}`,
                  { level: 'error' },
                )
              })
          } else {
            handle.updateAccessToken(oauthToken)
          }
        },
        label: 'bridge',
      })
    : null
  const loopStartTime = Date.now()
  // Track all in-flight cleanup promises (stopWork, worktree removal) so
  // the shutdown sequence can await them before process.exit().
  const pendingCleanups = new Set<Promise<unknown>>()
  function trackCleanup(p: Promise<unknown>): void {
    pendingCleanups.add(p)
    void p.finally(() => pendingCleanups.delete(p))
  }
  let connBackoff = 0
  let generalBackoff = 0
  let connErrorStart: number | null = null
  let generalErrorStart: number | null = null
  let lastPollErrorTime: number | null = null
  let statusUpdateTimer: ReturnType<typeof setInterval> | null = null
  // Set by BridgeFatalError and give-up paths so the shutdown block can
  // skip the resume message (resume is impossible after env expiry/auth
  // failure/sustained connection errors).
  let fatalExit = false

  logForDebugging(
    `[bridge:work] Starting poll loop spawnMode=${config.spawnMode} maxSessions=${config.maxSessions} environmentId=${environmentId}`,
  )
  logForDiagnosticsNoPII('info', 'bridge_loop_started', {
    max_sessions: config.maxSessions,
    spawn_mode: config.spawnMode,
  })

  // For ant users, show where session debug logs will land so they can tail them.
  // sessionRunner.ts uses the same base path. File appears once a session spawns.
  if (process.env.USER_TYPE === 'ant') {
    let debugGlob: string
    if (config.debugFile) {
      const ext = config.debugFile.lastIndexOf('.')
      debugGlob =
        ext > 0
          ? `${config.debugFile.slice(0, ext)}-*${config.debugFile.slice(ext)}`
          : `${config.debugFile}-*`
    } else {
      debugGlob = join(tmpdir(), 'claude', 'bridge-session-*.log')
    }
    logger.setDebugLogPath(debugGlob)
  }

  logger.printBanner(config, environmentId)

  // Seed the logger's session count + spawn mode before any render. Without
  // this, setAttached() below renders with the logger's default sessionMax=1,
  // showing "Capacity: 0/1" until the status ticker kicks in (which is gated
  // by !initialSessionId and only starts after the poll loop picks up work).
  logger.updateSessionCount(0, config.maxSessions, config.spawnMode)

  // If an initial session was pre-created, show its URL from the start so
  // the user can click through immediately (matching /remote-control behavior).
  if (initialSessionId) {
    logger.setAttached(initialSessionId)
  }

  /** Refresh the inline status display. Shows idle or active depending on state. */
  function updateStatusDisplay(): void {
    // Push the session count (no-op when maxSessions === 1) so the
    // next renderStatusLine tick shows the current count.
    logger.updateSessionCount(
      activeSessions.size,
      config.maxSessions,
      config.spawnMode,
    )

    // Push per-session activity into the multi-session display.
    for (const [sid, handle] of activeSessions) {
      const act = handle.currentActivity
      if (act) {
        logger.updateSessionActivity(sessionCompatIds.get(sid) ?? sid, act)
      }
    }

    if (activeSessions.size === 0) {
      logger.updateIdleStatus()
      return
    }

    // Show the most recently started session that is still actively working.
    // Sessions whose current activity is 'result' or 'error' are between
    // turns — the CLI emitted its result but the process stays alive waiting
    // for the next user message.  Skip updating so the status line keeps
    // whatever state it had (Attached / session title).
    const [sessionId, handle] = [...activeSessions.entries()].pop()!
    const startTime = sessionStartTimes.get(sessionId)
    if (!startTime) return

    const activity = handle.currentActivity
    if (!activity || activity.type === 'result' || activity.type === 'error') {
      // Session is between turns — keep current status (Attached/titled).
      // In multi-session mode, still refresh so bullet-list activities stay current.
      if (config.maxSessions > 1) logger.refreshDisplay()
      return
    }

    const elapsed = formatDuration(Date.now() - startTime)

    // Build trail from recent tool activities (last 5)
    const trail = handle.activities
      .filter(a => a.type === 'tool_start')
      .slice(-5)
      .map(a => a.summary)

    logger.updateSessionStatus(sessionId, elapsed, activity, trail)
  }

  /** Start the status display update ticker. */
  function startStatusUpdates(): void {
    stopStatusUpdates()
    // Call immediately so the first transition (e.g. Connecting → Ready)
    // happens without delay, avoiding concurrent timer races.
    updateStatusDisplay()
    statusUpdateTimer = setInterval(
      updateStatusDisplay,
      STATUS_UPDATE_INTERVAL_MS,
    )
  }

  /** Stop the status display update ticker. */
  function stopStatusUpdates(): void {
    if (statusUpdateTimer) {
      clearInterval(statusUpdateTimer)
      statusUpdateTimer = null
    }
  }

  function onSessionDone(
    sessionId: string,
    startTime: number,
    handle: SessionHandle,
  ): (status: SessionDoneStatus) => void {
    return (rawStatus: SessionDoneStatus): void => {
      const workId = sessionWorkIds.get(sessionId)
      activeSessions.delete(sessionId)
      sessionStartTimes.delete(sessionId)
      sessionWorkIds.delete(sessionId)
      sessionIngressTokens.delete(sessionId)
      const compatId = sessionCompatIds.get(sessionId) ?? sessionId
      sessionCompatIds.delete(sessionId)
      logger.removeSession(compatId)
      titledSessions.delete(compatId)
      v2Sessions.delete(sessionId)
      // Clear per-session timeout timer
      const timer = sessionTimers.get(sessionId)
      if (timer) {
        clearTimeout(timer)
        sessionTimers.delete(sessionId)
      }
      // Clear token refresh timer
      tokenRefresh?.cancel(sessionId)
      // Wake the at-capacity sleep so the bridge can accept new work immediately
      capacityWake.wake()

      // If the session was killed by the timeout watchdog, treat it as a
      // failed session (not a server/shutdown interrupt) so we still call
      // stopWork and archiveSession below.
      const wasTimedOut = timedOutSessions.delete(sessionId)
      const status: SessionDoneStatus =
        wasTimedOut && rawStatus === 'interrupted' ? 'failed' : rawStatus
      const durationMs = Date.now() - startTime

      logForDebugging(
        `[bridge:session] sessionId=${sessionId} workId=${workId ?? 'unknown'} exited status=${status} duration=${formatDuration(durationMs)}`,
      )
      logEvent('tengu_bridge_session_done', {
        status:
          status as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        duration_ms: durationMs,
      })
      logForDiagnosticsNoPII('info', 'bridge_session_done', {
        status,
        duration_ms: durationMs,
      })

      // Clear the status display before printing final log
      logger.clearStatus()
      stopStatusUpdates()

      // Build error message from stderr if available
      const stderrSummary =
        handle.lastStderr.length > 0 ? handle.lastStderr.join('\n') : undefined
      let failureMessage: string | undefined

      switch (status) {
        case 'completed':
          logger.logSessionComplete(sessionId, durationMs)
          break
        case 'failed':
          // Skip failure log during shutdown — the child exits non-zero when
          // killed, which is expected and not a real failure.
          // Also skip for timeout-killed sessions — the timeout watchdog
          // already logged a clear timeout message.
          if (!wasTimedOut && !loopSignal.aborted) {
            failureMessage = stderrSummary ?? 'Process exited with error'
            logger.logSessionFailed(sessionId, failureMessage)
            logError(new Error(`Bridge session failed: ${failureMessage}`))
          }
          break
        case 'interrupted':
          logger.logVerbose(`Session ${sessionId} interrupted`)
          break
      }

      // Notify the server that this work item is done. Skip for interrupted
      // sessions — interrupts are either server-initiated (the server already
      // knows) or caused by bridge shutdown (which calls stopWork() separately).
      if (status !== 'interrupted' && workId) {
        trackCleanup(
          stopWorkWithRetry(
            api,
            environmentId,
            workId,
            logger,
            backoffConfig.stopWorkBaseDelayMs,
          ),
        )
        completedWorkIds.add(workId)
      }

      // Clean up worktree if one was created for this session
      const wt = sessionWorktrees.get(sessionId)
      if (wt) {
        sessionWorktrees.delete(sessionId)
        trackCleanup(
          removeAgentWorktree(
            wt.worktreePath,
            wt.worktreeBranch,
            wt.gitRoot,
            wt.hookBased,
          ).catch((err: unknown) =>
            logger.logVerbose(
              `Failed to remove worktree ${wt.worktreePath}: ${errorMessage(err)}`,
            ),
          ),
        )
      }

      // Lifecycle decision: in multi-session mode, keep the bridge running
      // after a session completes. In single-session mode, abort the poll
      // loop so the bridge exits cleanly.
      if (status !== 'interrupted' && !loopSignal.aborted) {
        if (config.spawnMode !== 'single-session') {
          // Multi-session: archive the completed session so it doesn't linger
          // as stale in the web UI. archiveSession is idempotent (409 if already
          // archived), so double-archiving at shutdown is safe.
          // sessionId arrived as cse_* from the work poll (infrastructure-layer
          // tag). archiveSession hits /v1/sessions/{id}/archive which is the
          // compat surface and validates TagSession (session_*). Re-tag — same
          // UUID underneath.
          trackCleanup(
            api
              .archiveSession(compatId)
              .catch((err: unknown) =>
                logger.logVerbose(
                  `Failed to archive session ${sessionId}: ${errorMessage(err)}`,
                ),
              ),
          )
          logForDebugging(
            `[bridge:session] Session ${status}, returning to idle (multi-session mode)`,
          )
        } else {
          // Single-session: coupled lifecycle — tear down environment
          logForDebugging(
            `[bridge:session] Session ${status}, aborting poll loop to tear down environment`,
          )
          controller.abort()
          return
        }
      }

      if (!loopSignal.aborted) {
        startStatusUpdates()
      }
    }
  }

  // Start the idle status display immediately — unless we have a pre-created
  // session, in which case setAttached() already set up the display and the
  // poll loop will start status updates when it picks up the session.
  if (!initialSessionId) {
    startStatusUpdates()
  }

  while (!loopSignal.aborted) {
    // Fetched once per iteration — the GrowthBook cache refreshes every
    // 5 min, so a loop running at the at-capacity rate picks up config
    // changes within one sleep cycle.
    const pollConfig = getPollIntervalConfig()

    try {
      const work = await api.pollForWork(
        environmentId,
        environmentSecret,
        loopSignal,
        pollConfig.reclaim_older_than_ms,
      )

      // Log reconnection if we were previously disconnected
      const wasDisconnected =
        connErrorStart !== null || generalErrorStart !== null
      if (wasDisconnected) {
        const disconnectedMs =
          Date.now() - (connErrorStart ?? generalErrorStart ?? Date.now())
        logger.logReconnected(disconnectedMs)
        logForDebugging(
          `[bridge:poll] Reconnected after ${formatDuration(disconnectedMs)}`,
        )
        logEvent('tengu_bridge_reconnected', {
          disconnected_ms: disconnectedMs,
        })
      }

      connBackoff = 0
      generalBackoff = 0
      connErrorStart = null
      generalErrorStart = null
      lastPollErrorTime = null

      // Null response = no work available in the queue.
      // Add a minimum delay to avoid hammering the server.
      if (!work) {
        // Use live check (not a snapshot) since sessions can end during poll.
        const atCap = activeSessions.size >= config.maxSessions
        if (atCap) {
          const atCapMs = pollConfig.multisession_poll_interval_ms_at_capacity
          // Heartbeat loops WITHOUT polling. When at-capacity polling is also
          // enabled (atCapMs > 0), the loop tracks a deadline and breaks out
          // to poll at that interval — heartbeat and poll compose instead of
          // one suppressing the other. We break out to poll when:
          //   - Poll deadline reached (atCapMs > 0 only)
          //   - Auth fails (JWT expired → poll refreshes tokens)
          //   - Capacity wake fires (session ended → poll for new work)
          //   - Loop aborted (shutdown)
          if (pollConfig.non_exclusive_heartbeat_interval_ms > 0) {
            logEvent('tengu_bridge_heartbeat_mode_entered', {
              active_sessions: activeSessions.size,
              heartbeat_interval_ms:
                pollConfig.non_exclusive_heartbeat_interval_ms,
            })
            // Deadline computed once at entry — GB updates to atCapMs don't
            // shift an in-flight deadline (next entry picks up the new value).
            const pollDeadline = atCapMs > 0 ? Date.now() + atCapMs : null
            let hbResult: 'ok' | 'auth_failed' | 'fatal' | 'failed' = 'ok'
            let hbCycles = 0
            while (
              !loopSignal.aborted &&
              activeSessions.size >= config.maxSessions &&
              (pollDeadline === null || Date.now() < pollDeadline)
            ) {
              // Re-read config each cycle so GrowthBook updates take effect
              const hbConfig = getPollIntervalConfig()
              if (hbConfig.non_exclusive_heartbeat_interval_ms <= 0) break

              // Capture capacity signal BEFORE the async heartbeat call so
              // a session ending during the HTTP request is caught by the
              // subsequent sleep (instead of being lost to a replaced controller).
              const cap = capacityWake.signal()

              hbResult = await heartbeatActiveWorkItems()
              if (hbResult === 'auth_failed' || hbResult === 'fatal') {
                cap.cleanup()
                break
              }

              hbCycles++
              await sleep(
                hbConfig.non_exclusive_heartbeat_interval_ms,
                cap.signal,
              )
              cap.cleanup()
            }

            // Determine exit reason for telemetry
            const exitReason =
              hbResult === 'auth_failed' || hbResult === 'fatal'
                ? hbResult
                : loopSignal.aborted
                  ? 'shutdown'
                  : activeSessions.size < config.maxSessions
                    ? 'capacity_changed'
                    : pollDeadline !== null && Date.now() >= pollDeadline
                      ? 'poll_due'
                      : 'config_disabled'
            logEvent('tengu_bridge_heartbeat_mode_exited', {
              reason:
                exitReason as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
              heartbeat_cycles: hbCycles,
              active_sessions: activeSessions.size,
            })
            if (exitReason === 'poll_due') {
              // bridgeApi throttles empty-poll logs (EMPTY_POLL_LOG_INTERVAL=100)
              // so the once-per-10min poll_due poll is invisible at counter=2.
              // Log it here so verification runs see both endpoints in the debug log.
              logForDebugging(
                `[bridge:poll] Heartbeat poll_due after ${hbCycles} cycles — falling through to pollForWork`,
              )
            }

            // On auth_failed or fatal, sleep before polling to avoid a tight
            // poll+heartbeat loop. Auth_failed: heartbeatActiveWorkItems
            // already called reconnectSession — the sleep gives the server
            // time to propagate the re-queue. Fatal (404/410): may be a
            // single work item GCd while the environment is still valid.
            // Use atCapMs if enabled, else the heartbeat interval as a floor
            // (guaranteed > 0 here) so heartbeat-only configs don't tight-loop.
            if (hbResult === 'auth_failed' || hbResult === 'fatal') {
              const cap = capacityWake.signal()
              await sleep(
                atCapMs > 0
                  ? atCapMs
                  : pollConfig.non_exclusive_heartbeat_interval_ms,
                cap.signal,
              )
              cap.cleanup()
            }
          } else if (atCapMs > 0) {
            // Heartbeat disabled: slow poll as liveness signal.
            const cap = capacityWake.signal()
            await sleep(atCapMs, cap.signal)
            cap.cleanup()
          }
        } else {
          const interval =
            activeSessions.size > 0
              ? pollConfig.multisession_poll_interval_ms_partial_capacity
              : pollConfig.multisession_poll_interval_ms_not_at_capacity
          await sleep(interval, loopSignal)
        }
        continue
      }

      // At capacity — we polled to keep the heartbeat alive, but cannot
      // accept new work right now. We still enter the switch below so that
      // token refreshes for existing sessions are processed (the case
      // 'session' handler checks for existing sessions before the inner
      // capacity guard).
      const atCapacityBeforeSwitch = activeSessions.size >= config.maxSessions

      // Skip work items that have already been completed and stopped.
      // The server may re-deliver stale work before processing our stop
      // request, which would otherwise cause a duplicate session spawn.
      if (completedWorkIds.has(work.id)) {
        logForDebugging(
          `[bridge:work] Skipping already-completed workId=${work.id}`,
        )
        // Respect capacity throttle — without a sleep here, persistent stale
        // redeliveries would tight-loop at poll-request speed (the !work
        // branch above is the only sleep, and work != null skips it).
        if (atCapacityBeforeSwitch) {
          const cap = capacityWake.signal()
          if (pollConfig.non_exclusive_heartbeat_interval_ms > 0) {
            await heartbeatActiveWorkItems()
            await sleep(
              pollConfig.non_exclusive_heartbeat_interval_ms,
              cap.signal,
            )
          } else if (pollConfig.multisession_poll_interval_ms_at_capacity > 0) {
            await sleep(
              pollConfig.multisession_poll_interval_ms_at_capacity,
              cap.signal,
            )
          }
          cap.cleanup()
        } else {
          await sleep(1000, loopSignal)
        }
        continue
      }

      // Decode the work secret for session spawning and to extract the JWT
      // used for the ack call below.
      let secret
      try {
        secret = decodeWorkSecret(work.secret)
      } catch (err) {
        const errMsg = errorMessage(err)
        logger.logError(
          `Failed to decode work secret for workId=${work.id}: ${errMsg}`,
        )
        logEvent('tengu_bridge_work_secret_failed', {})
        // Can't ack (needs the JWT we failed to decode). stopWork uses OAuth,
        // so it's callable here — prevents XAUTOCLAIM from re-delivering this
        // poisoned item every reclaim_older_than_ms cycle.
        completedWorkIds.add(work.id)
        trackCleanup(
          stopWorkWithRetry(
            api,
            environmentId,
            work.id,
            logger,
            backoffConfig.stopWorkBaseDelayMs,
          ),
        )
        // Respect capacity throttle before retrying — without a sleep here,
        // repeated decode failures at capacity would tight-loop at
        // poll-request speed (work != null skips the !work sleep above).
        if (atCapacityBeforeSwitch) {
          const cap = capacityWake.signal()
          if (pollConfig.non_exclusive_heartbeat_interval_ms > 0) {
            await heartbeatActiveWorkItems()
            await sleep(
              pollConfig.non_exclusive_heartbeat_interval_ms,
              cap.signal,
            )
          } else if (pollConfig.multisession_poll_interval_ms_at_capacity > 0) {
            await sleep(
              pollConfig.multisession_poll_interval_ms_at_capacity,
              cap.signal,
            )
          }
          cap.cleanup()
        }
        continue
      }

      // Explicitly acknowledge after committing to handle the work — NOT
      // before. The at-capacity guard inside case 'session' can break
      // without spawning; acking there would permanently lose the work.
      // Ack failures are non-fatal: server re-delivers, and existingHandle
      // / completedWorkIds paths handle the dedup.
      const ackWork = async (): Promise<void> => {
        logForDebugging(`[bridge:work] Acknowledging workId=${work.id}`)
        try {
          await api.acknowledgeWork(
            environmentId,
            work.id,
            secret.session_ingress_token,
          )
        } catch (err) {
          logForDebugging(
            `[bridge:work] Acknowledge failed workId=${work.id}: ${errorMessage(err)}`,
          )
        }
      }

      const workType: string = work.data.type
      switch (work.data.type) {
        case 'healthcheck':
          await ackWork()
          logForDebugging('[bridge:work] Healthcheck received')
          logger.logVerbose('Healthcheck received')
          break
        case 'session': {
          const sessionId = work.data.id
          try {
            validateBridgeId(sessionId, 'session_id')
          } catch {
            await ackWork()
            logger.logError(`Invalid session_id received: ${sessionId}`)
            break
          }

          // If the session is already running, deliver the fresh token so
          // the child process can reconnect its WebSocket with the new
          // session ingress token. This handles the case where the server
          // re-dispatches work for an existing session after the WS drops.
          const existingHandle = activeSessions.get(sessionId)
          if (existingHandle) {
            existingHandle.updateAccessToken(secret.session_ingress_token)
            sessionIngressTokens.set(sessionId, secret.session_ingress_token)
            sessionWorkIds.set(sessionId, work.id)
            // Re-schedule next refresh from the fresh JWT's expiry. onRefresh
            // branches on v2Sessions so both v1 and v2 are safe here.
            tokenRefresh?.schedule(sessionId, secret.session_ingress_token)
            logForDebugging(
              `[bridge:work] Updated access token for existing sessionId=${sessionId} workId=${work.id}`,
            )
            await ackWork()
            break
          }

          // At capacity — token refresh for existing sessions is handled
          // above, but we cannot spawn new ones. The post-switch capacity
          // sleep will throttle the loop; just break here.
          if (activeSessions.size >= config.maxSessions) {
            logForDebugging(
              `[bridge:work] At capacity (${activeSessions.size}/${config.maxSessions}), cannot spawn new session for workId=${work.id}`,
            )
            break
          }

          await ackWork()
          const spawnStartTime = Date.now()

          // CCR v2 path: register this bridge as the session worker, get the
          // epoch, and point the child at /v1/code/sessions/{id}. The child
          // already has the full v2 client (SSETransport + CCRClient) — same
          // code path environment-manager launches in containers.
          //
          // v1 path: Session-Ingress WebSocket. Uses config.sessionIngressUrl
          // (not secret.api_base_url, which may point to a remote proxy tunnel
          // that doesn't know about locally-created sessions).
          let sdkUrl: string
          let useCcrV2 = false
          let workerEpoch: number | undefined
          // Server decides per-session via the work secret; env var is the
          // ant-dev override (e.g. forcing v2 before the server flag is on).
          if (
            secret.use_code_sessions === true ||
            isEnvTruthy(process.env.CLAUDE_BRIDGE_USE_CCR_V2)
          ) {
            sdkUrl = buildCCRv2SdkUrl(config.apiBaseUrl, sessionId)
            // Retry once on transient failure (network blip, 500) before
            // permanently giving up and killing the session.
            for (let attempt = 1; attempt <= 2; attempt++) {
              try {
                workerEpoch = await registerWorker(
                  sdkUrl,
                  secret.session_ingress_token,
                )
                useCcrV2 = true
                logForDebugging(
                  `[bridge:session] CCR v2: registered worker sessionId=${sessionId} epoch=${workerEpoch} attempt=${attempt}`,
                )
                break
              } catch (err) {
                const errMsg = errorMessage(err)
                if (attempt < 2) {
                  logForDebugging(
                    `[bridge:session] CCR v2: registerWorker attempt ${attempt} failed, retrying: ${errMsg}`,
                  )
                  await sleep(2_000, loopSignal)
                  if (loopSignal.aborted) break
                  continue
                }
                logger.logError(
                  `CCR v2 worker registration failed for session ${sessionId}: ${errMsg}`,
                )
                logError(new Error(`registerWorker failed: ${errMsg}`))
                completedWorkIds.add(work.id)
                trackCleanup(
                  stopWorkWithRetry(
                    api,
                    environmentId,
                    work.id,
                    logger,
                    backoffConfig.stopWorkBaseDelayMs,
                  ),
                )
              }
            }
            if (!useCcrV2) break
          } else {
            sdkUrl = buildSdkUrl(config.sessionIngressUrl, sessionId)
          }

          // In worktree mode, on-demand sessions get an isolated git worktree
          // so concurrent sessions don't interfere with each other's file
          // changes. The pre-created initial session (if any) runs in
          // config.dir so the user's first session lands in the directory they
          // invoked `rc` from — matching the old single-session UX.
          // In same-dir and single-session modes, all sessions share config.dir.
          // Capture spawnMode before the await below — the `w` key handler
          // mutates config.spawnMode directly, and createAgentWorktree can
          // take 1-2s, so reading config.spawnMode after the await can
          // produce contradictory analytics (spawn_mode:'same-dir', in_worktree:true).
          const spawnModeAtDecision = config.spawnMode
          let sessionDir = config.dir
          let worktreeCreateMs = 0
          if (
            spawnModeAtDecision === 'worktree' &&
            (initialSessionId === undefined ||
              !sameSessionId(sessionId, initialSessionId))
          ) {
            const wtStart = Date.now()
            try {
              const wt = await createAgentWorktree(
                `bridge-${safeFilenameId(sessionId)}`,
              )
              worktreeCreateMs = Date.now() - wtStart
              sessionWorktrees.set(sessionId, {
                worktreePath: wt.worktreePath,
                worktreeBranch: wt.worktreeBranch,
                gitRoot: wt.gitRoot,
                hookBased: wt.hookBased,
              })
              sessionDir = wt.worktreePath
              logForDebugging(
                `[bridge:session] Created worktree for sessionId=${sessionId} at ${wt.worktreePath}`,
              )
            } catch (err) {
              const errMsg = errorMessage(err)
              logger.logError(
                `Failed to create worktree for session ${sessionId}: ${errMsg}`,
              )
              logError(new Error(`Worktree creation failed: ${errMsg}`))
              completedWorkIds.add(work.id)
              trackCleanup(
                stopWorkWithRetry(
                  api,
                  environmentId,
                  work.id,
                  logger,
                  backoffConfig.stopWorkBaseDelayMs,
                ),
              )
              break
            }
          }

          logForDebugging(
            `[bridge:session] Spawning sessionId=${sessionId} sdkUrl=${sdkUrl}`,
          )

          // compat-surface session_* form for logger/Sessions-API calls.
          // Work poll returns cse_* under v2 compat; convert before spawn so
          // the onFirstUserMessage callback can close over it.
          const compatSessionId = toCompatSessionId(sessionId)

          const spawnResult = safeSpawn(
            spawner,
            {
              sessionId,
              sdkUrl,
              accessToken: secret.session_ingress_token,
              useCcrV2,
              workerEpoch,
              onFirstUserMessage: text => {
                // Server-set titles (--name, web rename) win. fetchSessionTitle
                // runs concurrently; if it already populated titledSessions,
                // skip. If it hasn't resolved yet, the derived title sticks —
                // acceptable since the server had no title at spawn time.
                if (titledSessions.has(compatSessionId)) return
                titledSessions.add(compatSessionId)
                const title = deriveSessionTitle(text)
                logger.setSessionTitle(compatSessionId, title)
                logForDebugging(
                  `[bridge:title] derived title for ${compatSessionId}: ${title}`,
                )
                void import('./createSession.js')
                  .then(({ updateBridgeSessionTitle }) =>
                    updateBridgeSessionTitle(compatSessionId, title, {
                      baseUrl: config.apiBaseUrl,
                    }),
                  )
                  .catch(err =>
                    logForDebugging(
                      `[bridge:title] failed to update title for ${compatSessionId}: ${err}`,
                      { level: 'error' },
                    ),
                  )
              },
            },
            sessionDir,
          )
          if (typeof spawnResult === 'string') {
            logger.logError(
              `Failed to spawn session ${sessionId}: ${spawnResult}`,
            )
            // Clean up worktree if one was created for this session
            const wt = sessionWorktrees.get(sessionId)
            if (wt) {
              sessionWorktrees.delete(sessionId)
              trackCleanup(
                removeAgentWorktree(
                  wt.worktreePath,
                  wt.worktreeBranch,
                  wt.gitRoot,
                  wt.hookBased,
                ).catch((err: unknown) =>
                  logger.logVerbose(
                    `Failed to remove worktree ${wt.worktreePath}: ${errorMessage(err)}`,
                  ),
                ),
              )
            }
            completedWorkIds.add(work.id)
            trackCleanup(
              stopWorkWithRetry(
                api,
                environmentId,
                work.id,
                logger,
                backoffConfig.stopWorkBaseDelayMs,
              ),
            )
            break
          }
          const handle = spawnResult

          const spawnDurationMs = Date.now() - spawnStartTime
          logEvent('tengu_bridge_session_started', {
            active_sessions: activeSessions.size,
            spawn_mode:
              spawnModeAtDecision as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
            in_worktree: sessionWorktrees.has(sessionId),
            spawn_duration_ms: spawnDurationMs,
            worktree_create_ms: worktreeCreateMs,
            inProtectedNamespace: isInProtectedNamespace(),
          })
          logForDiagnosticsNoPII('info', 'bridge_session_started', {
            spawn_mode: spawnModeAtDecision,
            in_worktree: sessionWorktrees.has(sessionId),
            spawn_duration_ms: spawnDurationMs,
            worktree_create_ms: worktreeCreateMs,
          })

          activeSessions.set(sessionId, handle)
          sessionWorkIds.set(sessionId, work.id)
          sessionIngressTokens.set(sessionId, secret.session_ingress_token)
          sessionCompatIds.set(sessionId, compatSessionId)

          const startTime = Date.now()
          sessionStartTimes.set(sessionId, startTime)

          // Use a generic prompt description since we no longer get startup_context
          logger.logSessionStart(sessionId, `Session ${sessionId}`)

          // Compute the actual debug file path (mirrors sessionRunner.ts logic)
          const safeId = safeFilenameId(sessionId)
          let sessionDebugFile: string | undefined
          if (config.debugFile) {
            const ext = config.debugFile.lastIndexOf('.')
            if (ext > 0) {
              sessionDebugFile = `${config.debugFile.slice(0, ext)}-${safeId}${config.debugFile.slice(ext)}`
            } else {
              sessionDebugFile = `${config.debugFile}-${safeId}`
            }
          } else if (config.verbose || process.env.USER_TYPE === 'ant') {
            sessionDebugFile = join(
              tmpdir(),
              'claude',
              `bridge-session-${safeId}.log`,
            )
          }

          if (sessionDebugFile) {
            logger.logVerbose(`Debug log: ${sessionDebugFile}`)
          }

          // Register in the sessions Map before starting status updates so the
          // first render tick shows the correct count and bullet list in sync.
          logger.addSession(
            compatSessionId,
            getRemoteSessionUrl(compatSessionId, config.sessionIngressUrl),
          )

          // Start live status updates and transition to "Attached" state.
          startStatusUpdates()
          logger.setAttached(compatSessionId)

          // One-shot title fetch. If the session already has a title (set via
          // --name, web rename, or /remote-control), display it and mark as
          // titled so the first-user-message fallback doesn't overwrite it.
          // Otherwise onFirstUserMessage derives one from the first prompt.
          void fetchSessionTitle(compatSessionId, config.apiBaseUrl)
            .then(title => {
              if (title && activeSessions.has(sessionId)) {
                titledSessions.add(compatSessionId)
                logger.setSessionTitle(compatSessionId, title)
                logForDebugging(
                  `[bridge:title] server title for ${compatSessionId}: ${title}`,
                )
              }
            })
            .catch(err =>
              logForDebugging(
                `[bridge:title] failed to fetch title for ${compatSessionId}: ${err}`,
                { level: 'error' },
              ),
            )

          // Start per-session timeout watchdog
          const timeoutMs =
            config.sessionTimeoutMs ?? DEFAULT_SESSION_TIMEOUT_MS
          if (timeoutMs > 0) {
            const timer = setTimeout(
              onSessionTimeout,
              timeoutMs,
              sessionId,
              timeoutMs,
              logger,
              timedOutSessions,
              handle,
            )
            sessionTimers.set(sessionId, timer)
          }

          // Schedule proactive token refresh before the JWT expires.
          // onRefresh branches on v2Sessions: v1 delivers OAuth to the
          // child, v2 triggers server re-dispatch via reconnectSession.
          if (useCcrV2) {
            v2Sessions.add(sessionId)
          }
          tokenRefresh?.schedule(sessionId, secret.session_ingress_token)

          void handle.done.then(onSessionDone(sessionId, startTime, handle))
          break
        }
        default:
          await ackWork()
          // Gracefully ignore unknown work types. The backend may send new
          // types before the bridge client is updated.
          logForDebugging(
            `[bridge:work] Unknown work type: ${workType}, skipping`,
          )
          break
      }

      // When at capacity, throttle the loop. The switch above still runs so
      // existing-session token refreshes are processed, but we sleep here
      // to avoid busy-looping. Include the capacity wake signal so the
      // sleep is interrupted immediately when a session completes.
      if (atCapacityBeforeSwitch) {
        const cap = capacityWake.signal()
        if (pollConfig.non_exclusive_heartbeat_interval_ms > 0) {
          await heartbeatActiveWorkItems()
          await sleep(
            pollConfig.non_exclusive_heartbeat_interval_ms,
            cap.signal,
          )
        } else if (pollConfig.multisession_poll_interval_ms_at_capacity > 0) {
          await sleep(
            pollConfig.multisession_poll_interval_ms_at_capacity,
            cap.signal,
          )
        }
        cap.cleanup()
      }
    } catch (err) {
      if (loopSignal.aborted) {
        break
      }

      // Fatal errors (401/403) — no point retrying, auth won't fix itself
      if (err instanceof BridgeFatalError) {
        fatalExit = true
        // Server-enforced expiry gets a clean status message, not an error
        if (isExpiredErrorType(err.errorType)) {
          logger.logStatus(err.message)
        } else if (isSuppressible403(err)) {
          // Cosmetic 403 errors (e.g., external_poll_sessions scope,
          // environments:manage permission) — don't show to user
          logForDebugging(`[bridge:work] Suppressed 403 error: ${err.message}`)
        } else {
          logger.logError(err.message)
          logError(err)
        }
        logEvent('tengu_bridge_fatal_error', {
          status: err.status,
          error_type:
            err.errorType as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        })
        logForDiagnosticsNoPII(
          isExpiredErrorType(err.errorType) ? 'info' : 'error',
          'bridge_fatal_error',
          { status: err.status, error_type: err.errorType },
        )
        break
      }

      const errMsg = describeAxiosError(err)

      if (isConnectionError(err) || isServerError(err)) {
        const now = Date.now()

        // Detect system sleep/wake: if the gap since the last poll error
        // greatly exceeds the expected backoff, the machine likely slept.
        // Reset error tracking so the bridge retries with a fresh budget.
        if (
          lastPollErrorTime !== null &&
          now - lastPollErrorTime > pollSleepDetectionThresholdMs(backoffConfig)
        ) {
          logForDebugging(
            `[bridge:work] Detected system sleep (${Math.round((now - lastPollErrorTime) / 1000)}s gap), resetting error budget`,
          )
          logForDiagnosticsNoPII('info', 'bridge_poll_sleep_detected', {
            gapMs: now - lastPollErrorTime,
          })
          connErrorStart = null
          connBackoff = 0
          generalErrorStart = null
          generalBackoff = 0
        }
        lastPollErrorTime = now

        if (!connErrorStart) {
          connErrorStart = now
        }
        const elapsed = now - connErrorStart
        if (elapsed >= backoffConfig.connGiveUpMs) {
          logger.logError(
            `Server unreachable for ${Math.round(elapsed / 60_000)} minutes, giving up.`,
          )
          logEvent('tengu_bridge_poll_give_up', {
            error_type:
              'connection' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
            elapsed_ms: elapsed,
          })
          logForDiagnosticsNoPII('error', 'bridge_poll_give_up', {
            error_type: 'connection',
            elapsed_ms: elapsed,
          })
          fatalExit = true
          break
        }

        // Reset the other track when switching error types
        generalErrorStart = null
        generalBackoff = 0

        connBackoff = connBackoff
          ? Math.min(connBackoff * 2, backoffConfig.connCapMs)
          : backoffConfig.connInitialMs
        const delay = addJitter(connBackoff)
        logger.logVerbose(
          `Connection error, retrying in ${formatDelay(delay)} (${Math.round(elapsed / 1000)}s elapsed): ${errMsg}`,
        )
        logger.updateReconnectingStatus(
          formatDelay(delay),
          formatDuration(elapsed),
        )
        // The poll_due heartbeat-loop exit leaves a healthy lease exposed to
        // this backoff path. Heartbeat before each sleep so /poll outages
        // (the VerifyEnvironmentSecretAuth DB path heartbeat was introduced
        // to avoid) don't kill the 300s lease TTL. No-op when activeSessions
        // is empty or heartbeat is disabled.
        if (getPollIntervalConfig().non_exclusive_heartbeat_interval_ms > 0) {
          await heartbeatActiveWorkItems()
        }
        await sleep(delay, loopSignal)
      } else {
        const now = Date.now()

        // Sleep detection for general errors (same logic as connection errors)
        if (
          lastPollErrorTime !== null &&
          now - lastPollErrorTime > pollSleepDetectionThresholdMs(backoffConfig)
        ) {
          logForDebugging(
            `[bridge:work] Detected system sleep (${Math.round((now - lastPollErrorTime) / 1000)}s gap), resetting error budget`,
          )
          logForDiagnosticsNoPII('info', 'bridge_poll_sleep_detected', {
            gapMs: now - lastPollErrorTime,
          })
          connErrorStart = null
          connBackoff = 0
          generalErrorStart = null
          generalBackoff = 0
        }
        lastPollErrorTime = now

        if (!generalErrorStart) {
          generalErrorStart = now
        }
        const elapsed = now - generalErrorStart
        if (elapsed >= backoffConfig.generalGiveUpMs) {
          logger.logError(
            `Persistent errors for ${Math.round(elapsed / 60_000)} minutes, giving up.`,
          )
          logEvent('tengu_bridge_poll_give_up', {
            error_type:
              'general' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
            elapsed_ms: elapsed,
          })
          logForDiagnosticsNoPII('error', 'bridge_poll_give_up', {
            error_type: 'general',
            elapsed_ms: elapsed,
          })
          fatalExit = true
          break
        }

        // Reset the other track when switching error types
        connErrorStart = null
        connBackoff = 0

        generalBackoff = generalBackoff
          ? Math.min(generalBackoff * 2, backoffConfig.generalCapMs)
          : backoffConfig.generalInitialMs
        const delay = addJitter(generalBackoff)
        logger.logVerbose(
          `Poll failed, retrying in ${formatDelay(delay)} (${Math.round(elapsed / 1000)}s elapsed): ${errMsg}`,
        )
        logger.updateReconnectingStatus(
          formatDelay(delay),
          formatDuration(elapsed),
        )
        if (getPollIntervalConfig().non_exclusive_heartbeat_interval_ms > 0) {
          await heartbeatActiveWorkItems()
        }
        await sleep(delay, loopSignal)
      }
    }
  }

  // Clean up
  stopStatusUpdates()
  logger.clearStatus()

  const loopDurationMs = Date.now() - loopStartTime
  logEvent('tengu_bridge_shutdown', {
    active_sessions: activeSessions.size,
    loop_duration_ms: loopDurationMs,
  })
  logForDiagnosticsNoPII('info', 'bridge_shutdown', {
    active_sessions: activeSessions.size,
    loop_duration_ms: loopDurationMs,
  })

  // Graceful shutdown: kill active sessions, report them as interrupted,
  // archive sessions, then deregister the environment so the web UI shows
  // the bridge as offline.

  // Collect all session IDs to archive on exit. This includes:
  // 1. Active sessions (snapshot before killing — onSessionDone clears maps)
  // 2. The initial auto-created session (may never have had work dispatched)
  // api.archiveSession is idempotent (409 if already archived), so
  // double-archiving is safe.
  const sessionsToArchive = new Set(activeSessions.keys())
  if (initialSessionId) {
    sessionsToArchive.add(initialSessionId)
  }
  // Snapshot before killing — onSessionDone clears sessionCompatIds.
  const compatIdSnapshot = new Map(sessionCompatIds)

  if (activeSessions.size > 0) {
    logForDebugging(
      `[bridge:shutdown] Shutting down ${activeSessions.size} active session(s)`,
    )
    logger.logStatus(
      `Shutting down ${activeSessions.size} active session(s)\u2026`,
    )

    // Snapshot work IDs before killing — onSessionDone clears the maps when
    // each child exits, so we need a copy for the stopWork calls below.
    const shutdownWorkIds = new Map(sessionWorkIds)

    for (const [sessionId, handle] of activeSessions.entries()) {
      logForDebugging(
        `[bridge:shutdown] Sending SIGTERM to sessionId=${sessionId}`,
      )
      handle.kill()
    }

    const timeout = new AbortController()
    await Promise.race([
      Promise.allSettled([...activeSessions.values()].map(h => h.done)),
      sleep(backoffConfig.shutdownGraceMs ?? 30_000, timeout.signal),
    ])
    timeout.abort()

    // SIGKILL any processes that didn't respond to SIGTERM within the grace window
    for (const [sid, handle] of activeSessions.entries()) {
      logForDebugging(`[bridge:shutdown] Force-killing stuck sessionId=${sid}`)
      handle.forceKill()
    }

    // Clear any remaining session timeout and refresh timers
    for (const timer of sessionTimers.values()) {
      clearTimeout(timer)
    }
    sessionTimers.clear()
    tokenRefresh?.cancelAll()

    // Clean up any remaining worktrees from active sessions.
    // Snapshot and clear the map first so onSessionDone (which may fire
    // during the await below when handle.done resolves) won't try to
    // remove the same worktrees again.
    if (sessionWorktrees.size > 0) {
      const remainingWorktrees = [...sessionWorktrees.values()]
      sessionWorktrees.clear()
      logForDebugging(
        `[bridge:shutdown] Cleaning up ${remainingWorktrees.length} worktree(s)`,
      )
      await Promise.allSettled(
        remainingWorktrees.map(wt =>
          removeAgentWorktree(
            wt.worktreePath,
            wt.worktreeBranch,
            wt.gitRoot,
            wt.hookBased,
          ),
        ),
      )
    }

    // Stop all active work items so the server knows they're done
    await Promise.allSettled(
      [...shutdownWorkIds.entries()].map(([sessionId, workId]) => {
        return api
          .stopWork(environmentId, workId, true)
          .catch(err =>
            logger.logVerbose(
              `Failed to stop work ${workId} for session ${sessionId}: ${errorMessage(err)}`,
            ),
          )
      }),
    )
  }

  // Ensure all in-flight cleanup (stopWork, worktree removal) from
  // onSessionDone completes before deregistering — otherwise
  // process.exit() can kill them mid-flight.
  if (pendingCleanups.size > 0) {
    await Promise.allSettled([...pendingCleanups])
  }

  // In single-session mode with a known session, leave the session and
  // environment alive so `claude remote-control --session-id=<id>` can resume.
  // The backend GCs stale environments via a 4h TTL (BRIDGE_LAST_POLL_TTL).
  // Archiving the session or deregistering the environment would make the
  // printed resume command a lie — deregister deletes Firestore + Redis stream.
  // Skip when the loop exited fatally (env expired, auth failed, give-up) —
  // resume is impossible in those cases and the message would contradict the
  // error already printed.
  // feature('KAIROS') gate: --session-id is ant-only; without the gate,
  // revert to the pre-PR behavior (archive + deregister on every shutdown).
  if (
    feature('KAIROS') &&
    config.spawnMode === 'single-session' &&
    initialSessionId &&
    !fatalExit
  ) {
    logger.logStatus(
      `Resume this session by running \`claude remote-control --continue\``,
    )
    logForDebugging(
      `[bridge:shutdown] Skipping archive+deregister to allow resume of session ${initialSessionId}`,
    )
    return
  }

  // Archive all known sessions so they don't linger as idle/running on the
  // server after the bridge goes offline.
  if (sessionsToArchive.size > 0) {
    logForDebugging(
      `[bridge:shutdown] Archiving ${sessionsToArchive.size} session(s)`,
    )
    await Promise.allSettled(
      [...sessionsToArchive].map(sessionId =>
        api
          .archiveSession(
            compatIdSnapshot.get(sessionId) ?? toCompatSessionId(sessionId),
          )
          .catch(err =>
            logger.logVerbose(
              `Failed to archive session ${sessionId}: ${errorMessage(err)}`,
            ),
          ),
      ),
    )
  }

  // Deregister the environment so the web UI shows the bridge as offline
  // and the Redis stream is cleaned up.
  try {
    await api.deregisterEnvironment(environmentId)
    logForDebugging(
      `[bridge:shutdown] Environment deregistered, bridge offline`,
    )
    logger.logVerbose('Environment deregistered.')
  } catch (err) {
    logger.logVerbose(`Failed to deregister environment: ${errorMessage(err)}`)
  }

  // Clear the crash-recovery pointer — the env is gone, pointer would be
  // stale. The early return above (resumable SIGINT shutdown) skips this,
  // leaving the pointer as a backup for the printed --session-id hint.
  const { clearBridgePointer } = await import('./bridgePointer.js')
  await clearBridgePointer(config.dir)

  logger.logVerbose('Environment offline.')
}

const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENETUNREACH',
  'EHOSTUNREACH',
])

export function isConnectionError(err: unknown): boolean {
  if (
    err &&
    typeof err === 'object' &&
    'code' in err &&
    typeof err.code === 'string' &&
    CONNECTION_ERROR_CODES.has(err.code)
  ) {
    return true
  }
  return false
}

/** Detect HTTP 5xx errors from axios (code: 'ERR_BAD_RESPONSE'). */
export function isServerError(err: unknown): boolean {
  return (
    !!err &&
    typeof err === 'object' &&
    'code' in err &&
    typeof err.code === 'string' &&
    err.code === 'ERR_BAD_RESPONSE'
  )
}

/** Add ±25% jitter to a delay value. */
function addJitter(ms: number): number {
  return Math.max(0, ms + ms * 0.25 * (2 * Math.random() - 1))
}

function formatDelay(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`
}

/**
 * Retry stopWork with exponential backoff (3 attempts, 1s/2s/4s).
 * Ensures the server learns the work item ended, preventing server-side zombies.
 */
async function stopWorkWithRetry(
  api: BridgeApiClient,
  environmentId: string,
  workId: string,
  logger: BridgeLogger,
  baseDelayMs = 1000,
): Promise<void> {
  const MAX_ATTEMPTS = 3

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await api.stopWork(environmentId, workId, false)
      logForDebugging(
        `[bridge:work] stopWork succeeded for workId=${workId} on attempt ${attempt}/${MAX_ATTEMPTS}`,
      )
      return
    } catch (err) {
      // Auth/permission errors won't be fixed by retrying
      if (err instanceof BridgeFatalError) {
        if (isSuppressible403(err)) {
          logForDebugging(
            `[bridge:work] Suppressed stopWork 403 for ${workId}: ${err.message}`,
          )
        } else {
          logger.logError(`Failed to stop work ${workId}: ${err.message}`)
        }
        logForDiagnosticsNoPII('error', 'bridge_stop_work_failed', {
          attempts: attempt,
          fatal: true,
        })
        return
      }
      const errMsg = errorMessage(err)
      if (attempt < MAX_ATTEMPTS) {
        const delay = addJitter(baseDelayMs * Math.pow(2, attempt - 1))
        logger.logVerbose(
          `Failed to stop work ${workId} (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${formatDelay(delay)}: ${errMsg}`,
        )
        await sleep(delay)
      } else {
        logger.logError(
          `Failed to stop work ${workId} after ${MAX_ATTEMPTS} attempts: ${errMsg}`,
        )
        logForDiagnosticsNoPII('error', 'bridge_stop_work_failed', {
          attempts: MAX_ATTEMPTS,
        })
      }
    }
  }
}

function onSessionTimeout(
  sessionId: string,
  timeoutMs: number,
  logger: BridgeLogger,
  timedOutSessions: Set<string>,
  handle: SessionHandle,
): void {
  logForDebugging(
    `[bridge:session] sessionId=${sessionId} timed out after ${formatDuration(timeoutMs)}`,
  )
  logEvent('tengu_bridge_session_timeout', {
    timeout_ms: timeoutMs,
  })
  logger.logSessionFailed(
    sessionId,
    `Session timed out after ${formatDuration(timeoutMs)}`,
  )
  timedOutSessions.add(sessionId)
  handle.kill()
}

export type ParsedArgs = {
  verbose: boolean
  sandbox: boolean
  debugFile?: string
  sessionTimeoutMs?: number
  permissionMode?: string
  name?: string
  /** Value passed to --spawn (if any); undefined if no --spawn flag was given. */
  spawnMode: SpawnMode | undefined
  /** Value passed to --capacity (if any); undefined if no --capacity flag was given. */
  capacity: number | undefined
  /** --[no-]create-session-in-dir override; undefined = use default (on). */
  createSessionInDir: boolean | undefined
  /** Resume an existing session instead of creating a new one. */
  sessionId?: string
  /** Resume the last session in this directory (reads bridge-pointer.json). */
  continueSession: boolean
  help: boolean
  error?: string
}

const SPAWN_FLAG_VALUES = ['session', 'same-dir', 'worktree'] as const

function parseSpawnValue(raw: string | undefined): SpawnMode | string {
  if (raw === 'session') return 'single-session'
  if (raw === 'same-dir') return 'same-dir'
  if (raw === 'worktree') return 'worktree'
  return `--spawn requires one of: ${SPAWN_FLAG_VALUES.join(', ')} (got: ${raw ?? '<missing>'})`
}

function parseCapacityValue(raw: string | undefined): number | string {
  const n = raw === undefined ? NaN : parseInt(raw, 10)
  if (isNaN(n) || n < 1) {
    return `--capacity requires a positive integer (got: ${raw ?? '<missing>'})`
  }
  return n
}

export function parseArgs(args: string[]): ParsedArgs {
  let verbose = false
  let sandbox = false
  let debugFile: string | undefined
  let sessionTimeoutMs: number | undefined
  let permissionMode: string | undefined
  let name: string | undefined
  let help = false
  let spawnMode: SpawnMode | undefined
  let capacity: number | undefined
  let createSessionInDir: boolean | undefined
  let sessionId: string | undefined
  let continueSession = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === '--help' || arg === '-h') {
      help = true
    } else if (arg === '--verbose' || arg === '-v') {
      verbose = true
    } else if (arg === '--sandbox') {
      sandbox = true
    } else if (arg === '--no-sandbox') {
      sandbox = false
    } else if (arg === '--debug-file' && i + 1 < args.length) {
      debugFile = resolve(args[++i]!)
    } else if (arg.startsWith('--debug-file=')) {
      debugFile = resolve(arg.slice('--debug-file='.length))
    } else if (arg === '--session-timeout' && i + 1 < args.length) {
      sessionTimeoutMs = parseInt(args[++i]!, 10) * 1000
    } else if (arg.startsWith('--session-timeout=')) {
      sessionTimeoutMs =
        parseInt(arg.slice('--session-timeout='.length), 10) * 1000
    } else if (arg === '--permission-mode' && i + 1 < args.length) {
      permissionMode = args[++i]!
    } else if (arg.startsWith('--permission-mode=')) {
      permissionMode = arg.slice('--permission-mode='.length)
    } else if (arg === '--name' && i + 1 < args.length) {
      name = args[++i]!
    } else if (arg.startsWith('--name=')) {
      name = arg.slice('--name='.length)
    } else if (
      feature('KAIROS') &&
      arg === '--session-id' &&
      i + 1 < args.length
    ) {
      sessionId = args[++i]!
      if (!sessionId) {
        return makeError('--session-id requires a value')
      }
    } else if (feature('KAIROS') && arg.startsWith('--session-id=')) {
      sessionId = arg.slice('--session-id='.length)
      if (!sessionId) {
        return makeError('--session-id requires a value')
      }
    } else if (feature('KAIROS') && (arg === '--continue' || arg === '-c')) {
      continueSession = true
    } else if (arg === '--spawn' || arg.startsWith('--spawn=')) {
      if (spawnMode !== undefined) {
        return makeError('--spawn may only be specified once')
      }
      const raw = arg.startsWith('--spawn=')
        ? arg.slice('--spawn='.length)
        : args[++i]
      const v = parseSpawnValue(raw)
      if (v === 'single-session' || v === 'same-dir' || v === 'worktree') {
        spawnMode = v
      } else {
        return makeError(v)
      }
    } else if (arg === '--capacity' || arg.startsWith('--capacity=')) {
      if (capacity !== undefined) {
        return makeError('--capacity may only be specified once')
      }
      const raw = arg.startsWith('--capacity=')
        ? arg.slice('--capacity='.length)
        : args[++i]
      const v = parseCapacityValue(raw)
      if (typeof v === 'number') capacity = v
      else return makeError(v)
    } else if (arg === '--create-session-in-dir') {
      createSessionInDir = true
    } else if (arg === '--no-create-session-in-dir') {
      createSessionInDir = false
    } else {
      return makeError(
        `Unknown argument: ${arg}\nRun 'claude remote-control --help' for usage.`,
      )
    }
  }

  // Note: gate check for --spawn/--capacity/--create-session-in-dir is in bridgeMain
  // (gate-aware error). Flag cross-validation happens here.

  // --capacity only makes sense for multi-session modes.
  if (spawnMode === 'single-session' && capacity !== undefined) {
    return makeError(
      `--capacity cannot be used with --spawn=session (single-session mode has fixed capacity 1).`,
    )
  }

  // --session-id / --continue resume a specific session on its original
  // environment; incompatible with spawn-related flags (which configure
  // fresh session creation), and mutually exclusive with each other.
  if (
    (sessionId || continueSession) &&
    (spawnMode !== undefined ||
      capacity !== undefined ||
      createSessionInDir !== undefined)
  ) {
    return makeError(
      `--session-id and --continue cannot be used with --spawn, --capacity, or --create-session-in-dir.`,
    )
  }
  if (sessionId && continueSession) {
    return makeError(`--session-id and --continue cannot be used together.`)
  }

  return {
    verbose,
    sandbox,
    debugFile,
    sessionTimeoutMs,
    permissionMode,
    name,
    spawnMode,
    capacity,
    createSessionInDir,
    sessionId,
    continueSession,
    help,
  }

  function makeError(error: string): ParsedArgs {
    return {
      verbose,
      sandbox,
      debugFile,
      sessionTimeoutMs,
      permissionMode,
      name,
      spawnMode,
      capacity,
      createSessionInDir,
      sessionId,
      continueSession,
      help,
      error,
    }
  }
}

async function printHelp(): Promise<void> {
  // Use EXTERNAL_PERMISSION_MODES for help text — internal modes (bubble)
  // are ant-only and auto is feature-gated; they're still accepted by validation.
  const { EXTERNAL_PERMISSION_MODES } = await import('../types/permissions.js')
  const modes = EXTERNAL_PERMISSION_MODES.join(', ')
  const showServer = await isMultiSessionSpawnEnabled()
  const serverOptions = showServer
    ? `  --spawn <mode>                   Spawn mode: same-dir, worktree, session
                                   (default: same-dir)
  --capacity <N>                   Max concurrent sessions in worktree or
                                   same-dir mode (default: ${SPAWN_SESSIONS_DEFAULT})
  --[no-]create-session-in-dir     Pre-create a session in the current
                                   directory; in worktree mode this session
                                   stays in cwd while on-demand sessions get
                                   isolated worktrees (default: on)
`
    : ''
  const serverDescription = showServer
    ? `
  Remote Control runs as a persistent server that accepts multiple concurrent
  sessions in the current directory. One session is pre-created on start so
  you have somewhere to type immediately. Use --spawn=worktree to isolate
  each on-demand session in its own git worktree, or --spawn=session for
  the classic single-session mode (exits when that session ends). Press 'w'
  during runtime to toggle between same-dir and worktree.
`
    : ''
  const serverNote = showServer
    ? `  - Worktree mode requires a git repository or WorktreeCreate/WorktreeRemove hooks
`
    : ''
  const help = `
Remote Control - Connect your local environment to claude.ai/code

USAGE
  claude remote-control [options]
OPTIONS
  --name <name>                    Name for the session (shown in claude.ai/code)
${
  feature('KAIROS')
    ? `  -c, --continue                   Resume the last session in this directory
  --session-id <id>                Resume a specific session by ID (cannot be
                                   used with spawn flags or --continue)
`
    : ''
}  --permission-mode <mode>         Permission mode for spawned sessions
                                   (${modes})
  --debug-file <path>              Write debug logs to file
  -v, --verbose                    Enable verbose output
  -h, --help                       Show this help
${serverOptions}
DESCRIPTION
  Remote Control allows you to control sessions on your local device from
  claude.ai/code (https://claude.ai/code). Run this command in the
  directory you want to work in, then connect from the Claude app or web.
${serverDescription}
NOTES
  - You must be logged in with a Claude account that has a subscription
  - Run \`claude\` first in the directory to accept the workspace trust dialog
${serverNote}`
  // biome-ignore lint/suspicious/noConsole: intentional help output
  console.log(help)
}

const TITLE_MAX_LEN = 80

/** Derive a session title from a user message: first line, truncated. */
function deriveSessionTitle(text: string): string {
  // Collapse whitespace — newlines/tabs would break the single-line status display.
  const flat = text.replace(/\s+/g, ' ').trim()
  return truncateToWidth(flat, TITLE_MAX_LEN)
}

/**
 * One-shot fetch of a session's title via GET /v1/sessions/{id}.
 *
 * Uses `getBridgeSession` from createSession.ts (ccr-byoc headers + org UUID)
 * rather than the environments-level bridgeApi client, whose headers make the
 * Sessions API return 404. Returns undefined if the session has no title yet
 * or the fetch fails — the caller falls back to deriving a title from the
 * first user message.
 */
async function fetchSessionTitle(
  compatSessionId: string,
  baseUrl: string,
): Promise<string | undefined> {
  const { getBridgeSession } = await import('./createSession.js')
  const session = await getBridgeSession(compatSessionId, { baseUrl })
  return session?.title || undefined
}

export async function bridgeMain(args: string[]): Promise<void> {
  const parsed = parseArgs(args)

  if (parsed.help) {
    await printHelp()
    return
  }
  if (parsed.error) {
    // biome-ignore lint/suspicious/noConsole: intentional error output
    console.error(`Error: ${parsed.error}`)
    // eslint-disable-next-line custom-rules/no-process-exit
    process.exit(1)
  }

  const {
    verbose,
    sandbox,
    debugFile,
    sessionTimeoutMs,
    permissionMode,
    name,
    spawnMode: parsedSpawnMode,
    capacity: parsedCapacity,
    createSessionInDir: parsedCreateSessionInDir,
    sessionId: parsedSessionId,
    continueSession,
  } = parsed
  // Mutable so --continue can set it from the pointer file. The #20460
  // resume flow below then treats it the same as an explicit --session-id.
  let resumeSessionId = parsedSessionId
  // When --continue found a pointer, this is the directory it came from
  // (may be a worktree sibling, not `dir`). On resume-flow deterministic
  // failure, clear THIS file so --continue doesn't keep hitting the same
  // dead session. Undefined for explicit --session-id (leaves pointer alone).
  let resumePointerDir: string | undefined

  const usedMultiSessionFeature =
    parsedSpawnMode !== undefined ||
    parsedCapacity !== undefined ||
    parsedCreateSessionInDir !== undefined

  // Validate permission mode early so the user gets an error before
  // the bridge starts polling for work.
  if (permissionMode !== undefined) {
    const { PERMISSION_MODES } = await import('../types/permissions.js')
    const valid: readonly string[] = PERMISSION_MODES
    if (!valid.includes(permissionMode)) {
      // biome-ignore lint/suspicious/noConsole: intentional error output
      console.error(
        `Error: Invalid permission mode '${permissionMode}'. Valid modes: ${valid.join(', ')}`,
      )
      // eslint-disable-next-line custom-rules/no-process-exit
      process.exit(1)
    }
  }

  const dir = resolve('.')

  // The bridge fast-path bypasses init.ts, so we must enable config reading
  // before any code that transitively calls getGlobalConfig()
  const { enableConfigs, checkHasTrustDialogAccepted } = await import(
    '../utils/config.js'
  )
  enableConfigs()

  // Initialize analytics and error reporting sinks. The bridge bypasses the
  // setup() init flow, so we call initSinks() directly to attach sinks here.
  const { initSinks } = await import('../utils/sinks.js')
  initSinks()

  // Gate-aware validation: --spawn / --capacity / --create-session-in-dir require
  // the multi-session gate. parseArgs has already validated flag combinations;
  // here we only check the gate since that requires an async GrowthBook call.
  // Runs after enableConfigs() (GrowthBook cache reads global config) and after
  // initSinks() so the denial event can be enqueued.
  const multiSessionEnabled = await isMultiSessionSpawnEnabled()
  if (usedMultiSessionFeature && !multiSessionEnabled) {
    await logEventAsync('tengu_bridge_multi_session_denied', {
      used_spawn: parsedSpawnMode !== undefined,
      used_capacity: parsedCapacity !== undefined,
      used_create_session_in_dir: parsedCreateSessionInDir !== undefined,
    })
    // logEventAsync only enqueues — process.exit() discards buffered events.
    // Flush explicitly, capped at 500ms to match gracefulShutdown.ts.
    // (sleep() doesn't unref its timer, but process.exit() follows immediately
    // so the ref'd timer can't delay shutdown.)
    await Promise.race([
      Promise.all([shutdown1PEventLogging(), shutdownDatadog()]),
      sleep(500, undefined, { unref: true }),
    ]).catch(() => {})
    // biome-ignore lint/suspicious/noConsole: intentional error output
    console.error(
      'Error: Multi-session Remote Control is not enabled for your account yet.',
    )
    // eslint-disable-next-line custom-rules/no-process-exit
    process.exit(1)
  }

  // Set the bootstrap CWD so that trust checks, project config lookups, and
  // git utilities (getBranch, getRemoteUrl) resolve against the correct path.
  const { setOriginalCwd, setCwdState } = await import('../bootstrap/state.js')
  setOriginalCwd(dir)
  setCwdState(dir)

  // The bridge bypasses main.tsx (which renders the interactive TrustDialog via showSetupScreens),
  // so we must verify trust was previously established by a normal `claude` session.
  if (!checkHasTrustDialogAccepted()) {
    // biome-ignore lint/suspicious/noConsole:: intentional console output
    console.error(
      `Error: Workspace not trusted. Please run \`claude\` in ${dir} first to review and accept the workspace trust dialog.`,
    )
    // eslint-disable-next-line custom-rules/no-process-exit
    process.exit(1)
  }

  // Resolve auth
  const { clearOAuthTokenCache, checkAndRefreshOAuthTokenIfNeeded } =
    await import('../utils/auth.js')
  const { getBridgeAccessToken, getBridgeBaseUrl } = await import(
    './bridgeConfig.js'
  )

  const bridgeToken = getBridgeAccessToken()
  if (!bridgeToken) {
    // biome-ignore lint/suspicious/noConsole:: intentional console output
    console.error(BRIDGE_LOGIN_ERROR)
    // eslint-disable-next-line custom-rules/no-process-exit
    process.exit(1)
  }

  // First-time remote dialog — explain what bridge does and get consent
  const {
    getGlobalConfig,
    saveGlobalConfig,
    getCurrentProjectConfig,
    saveCurrentProjectConfig,
  } = await import('../utils/config.js')
  if (!getGlobalConfig().remoteDialogSeen) {
    const readline = await import('readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    // biome-ignore lint/suspicious/noConsole:: intentional console output
    console.log(
      '\nRemote Control lets you access this CLI session from the web (claude.ai/code)\nor the Claude app, so you can pick up where you left off on any device.\n\nYou can disconnect remote access anytime by running /remote-control again.\n',
    )
    const answer = await new Promise<string>(resolve => {
      rl.question('Enable Remote Control? (y/n) ', resolve)
    })
    rl.close()
    saveGlobalConfig(current => {
      if (current.remoteDialogSeen) return current
      return { ...current, remoteDialogSeen: true }
    })
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      // eslint-disable-next-line custom-rules/no-process-exit
      process.exit(0)
    }
  }

  // --continue: resolve the most recent session from the crash-recovery
  // pointer and chain into the #20460 --session-id flow. Worktree-aware:
  // checks current dir first (fast path, zero exec), then fans out to git
  // worktree siblings if that misses — the REPL bridge writes to
  // getOriginalCwd() which EnterWorktreeTool/activeWorktreeSession can
  // point at a worktree while the user's shell is at the repo root.
  // KAIROS-gated at parseArgs — continueSession is always false in external
  // builds, so this block tree-shakes.
  if (feature('KAIROS') && continueSession) {
    const { readBridgePointerAcrossWorktrees } = await import(
      './bridgePointer.js'
    )
    const found = await readBridgePointerAcrossWorktrees(dir)
    if (!found) {
      // biome-ignore lint/suspicious/noConsole: intentional error output
      console.error(
        `Error: No recent session found in this directory or its worktrees. Run \`claude remote-control\` to start a new one.`,
      )
      // eslint-disable-next-line custom-rules/no-process-exit
      process.exit(1)
    }
    const { pointer, dir: pointerDir } = found
    const ageMin = Math.round(pointer.ageMs / 60_000)
    const ageStr = ageMin < 60 ? `${ageMin}m` : `${Math.round(ageMin / 60)}h`
    const fromWt = pointerDir !== dir ? ` from worktree ${pointerDir}` : ''
    // biome-ignore lint/suspicious/noConsole: intentional info output
    console.error(
      `Resuming session ${pointer.sessionId} (${ageStr} ago)${fromWt}\u2026`,
    )
    resumeSessionId = pointer.sessionId
    // Track where the pointer came from so the #20460 exit(1) paths below
    // clear the RIGHT file on deterministic failure — otherwise --continue
    // would keep hitting the same dead session. May be a worktree sibling.
    resumePointerDir = pointerDir
  }

  // In production, baseUrl is the Anthropic API (from OAuth config).
  // CLAUDE_BRIDGE_BASE_URL overrides this for ant local dev only.
  const baseUrl = getBridgeBaseUrl()

  // For non-localhost targets, require HTTPS to protect credentials.
  if (
    baseUrl.startsWith('http://') &&
    !baseUrl.includes('localhost') &&
    !baseUrl.includes('127.0.0.1')
  ) {
    // biome-ignore lint/suspicious/noConsole:: intentional console output
    console.error(
      'Error: Remote Control base URL uses HTTP. Only HTTPS or localhost HTTP is allowed.',
    )
    // eslint-disable-next-line custom-rules/no-process-exit
    process.exit(1)
  }

  // Session ingress URL for WebSocket connections. In production this is the
  // same as baseUrl (Envoy routes /v1/session_ingress/* to session-ingress).
  // Locally, session-ingress runs on a different port (9413) than the
  // contain-provide-api (8211), so CLAUDE_BRIDGE_SESSION_INGRESS_URL must be
  // set explicitly. Ant-only, matching CLAUDE_BRIDGE_BASE_URL.
  const sessionIngressUrl =
    process.env.USER_TYPE === 'ant' &&
    process.env.CLAUDE_BRIDGE_SESSION_INGRESS_URL
      ? process.env.CLAUDE_BRIDGE_SESSION_INGRESS_URL
      : baseUrl

  const { getBranch, getRemoteUrl, findGitRoot } = await import(
    '../utils/git.js'
  )

  // Precheck worktree availability for the first-run dialog and the `w`
  // toggle. Unconditional so we know upfront whether worktree is an option.
  const { hasWorktreeCreateHook } = await import('../utils/hooks.js')
  const worktreeAvailable = hasWorktreeCreateHook() || findGitRoot(dir) !== null

  // Load saved per-project spawn-mode preference. Gated by multiSessionEnabled
  // so a GrowthBook rollback cleanly reverts users to single-session —
  // otherwise a saved pref would silently re-enable multi-session behavior
  // (worktree isolation, 32 max sessions, w toggle) despite the gate being off.
  // Also guard against a stale worktree pref left over from when this dir WAS
  // a git repo (or the user copied config) — clear it on disk so the warning
  // doesn't repeat on every launch.
  let savedSpawnMode = multiSessionEnabled
    ? getCurrentProjectConfig().remoteControlSpawnMode
    : undefined
  if (savedSpawnMode === 'worktree' && !worktreeAvailable) {
    // biome-ignore lint/suspicious/noConsole: intentional warning output
    console.error(
      'Warning: Saved spawn mode is worktree but this directory is not a git repository. Falling back to same-dir.',
    )
    savedSpawnMode = undefined
    saveCurrentProjectConfig(current => {
      if (current.remoteControlSpawnMode === undefined) return current
      return { ...current, remoteControlSpawnMode: undefined }
    })
  }

  // First-run spawn-mode choice: ask once per project when the choice is
  // meaningful (gate on, both modes available, no explicit override, not
  // resuming). Saves to ProjectConfig so subsequent runs skip this.
  if (
    multiSessionEnabled &&
    !savedSpawnMode &&
    worktreeAvailable &&
    parsedSpawnMode === undefined &&
    !resumeSessionId &&
    process.stdin.isTTY
  ) {
    const readline = await import('readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    // biome-ignore lint/suspicious/noConsole: intentional dialog output
    console.log(
      `\nClaude Remote Control is launching in spawn mode which lets you create new sessions in this project from Claude Code on Web or your Mobile app. Learn more here: https://code.claude.com/docs/en/remote-control\n\n` +
        `Spawn mode for this project:\n` +
        `  [1] same-dir \u2014 sessions share the current directory (default)\n` +
        `  [2] worktree \u2014 each session gets an isolated git worktree\n\n` +
        `This can be changed later or explicitly set with --spawn=same-dir or --spawn=worktree.\n`,
    )
    const answer = await new Promise<string>(resolve => {
      rl.question('Choose [1/2] (default: 1): ', resolve)
    })
    rl.close()
    const chosen: 'same-dir' | 'worktree' =
      answer.trim() === '2' ? 'worktree' : 'same-dir'
    savedSpawnMode = chosen
    logEvent('tengu_bridge_spawn_mode_chosen', {
      spawn_mode:
        chosen as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
    saveCurrentProjectConfig(current => {
      if (current.remoteControlSpawnMode === chosen) return current
      return { ...current, remoteControlSpawnMode: chosen }
    })
  }

  // Determine effective spawn mode.
  // Precedence: resume > explicit --spawn > saved project pref > gate default
  // - resuming via --continue / --session-id: always single-session (resume
  //   targets one specific session in its original directory)
  // - explicit --spawn flag: use that value directly (does not persist)
  // - saved ProjectConfig.remoteControlSpawnMode: set by first-run dialog or `w`
  // - default with gate on: same-dir (persistent multi-session, shared cwd)
  // - default with gate off: single-session (unchanged legacy behavior)
  // Track how spawn mode was determined, for rollout analytics.
  type SpawnModeSource = 'resume' | 'flag' | 'saved' | 'gate_default'
  let spawnModeSource: SpawnModeSource
  let spawnMode: SpawnMode
  if (resumeSessionId) {
    spawnMode = 'single-session'
    spawnModeSource = 'resume'
  } else if (parsedSpawnMode !== undefined) {
    spawnMode = parsedSpawnMode
    spawnModeSource = 'flag'
  } else if (savedSpawnMode !== undefined) {
    spawnMode = savedSpawnMode
    spawnModeSource = 'saved'
  } else {
    spawnMode = multiSessionEnabled ? 'same-dir' : 'single-session'
    spawnModeSource = 'gate_default'
  }
  const maxSessions =
    spawnMode === 'single-session'
      ? 1
      : (parsedCapacity ?? SPAWN_SESSIONS_DEFAULT)
  // Pre-create an empty session on start so the user has somewhere to type
  // immediately, running in the current directory (exempted from worktree
  // creation in the spawn loop). On by default; --no-create-session-in-dir
  // opts out for a pure on-demand server where every session is isolated.
  // The effectiveResumeSessionId guard at the creation site handles the
  // resume case (skip creation when resume succeeded; fall through to
  // fresh creation on env-mismatch fallback).
  const preCreateSession = parsedCreateSessionInDir ?? true

  // Without --continue: a leftover pointer means the previous run didn't
  // shut down cleanly (crash, kill -9, terminal closed). Clear it so the
  // stale env doesn't linger past its relevance. Runs in all modes
  // (clearBridgePointer is a no-op when no file exists) — covers the
  // gate-transition case where a user crashed in single-session mode then
  // starts fresh in worktree mode. Only single-session mode writes new
  // pointers.
  if (!resumeSessionId) {
    const { clearBridgePointer } = await import('./bridgePointer.js')
    await clearBridgePointer(dir)
  }

  // Worktree mode requires either git or WorktreeCreate/WorktreeRemove hooks.
  // Only reachable via explicit --spawn=worktree (default is same-dir);
  // saved worktree pref was already guarded above.
  if (spawnMode === 'worktree' && !worktreeAvailable) {
    // biome-ignore lint/suspicious/noConsole: intentional error output
    console.error(
      `Error: Worktree mode requires a git repository or WorktreeCreate hooks configured. Use --spawn=session for single-session mode.`,
    )
    // eslint-disable-next-line custom-rules/no-process-exit
    process.exit(1)
  }

  const branch = await getBranch()
  const gitRepoUrl = await getRemoteUrl()
  const machineName = hostname()
  const bridgeId = randomUUID()

  const { handleOAuth401Error } = await import('../utils/auth.js')
  const api = createBridgeApiClient({
    baseUrl,
    getAccessToken: getBridgeAccessToken,
    runnerVersion: MACRO.VERSION,
    onDebug: logForDebugging,
    onAuth401: handleOAuth401Error,
    getTrustedDeviceToken,
  })

  // When resuming a session via --session-id, fetch it to learn its
  // environment_id and reuse that for registration (idempotent on the
  // backend). Left undefined otherwise — the backend rejects
  // client-generated UUIDs and will allocate a fresh environment.
  // feature('KAIROS') gate: --session-id is ant-only; parseArgs already
  // rejects the flag when the gate is off, so resumeSessionId is always
  // undefined here in external builds — this guard is for tree-shaking.
  let reuseEnvironmentId: string | undefined
  if (feature('KAIROS') && resumeSessionId) {
    try {
      validateBridgeId(resumeSessionId, 'sessionId')
    } catch {
      // biome-ignore lint/suspicious/noConsole: intentional error output
      console.error(
        `Error: Invalid session ID "${resumeSessionId}". Session IDs must not contain unsafe characters.`,
      )
      // eslint-disable-next-line custom-rules/no-process-exit
      process.exit(1)
    }
    // Proactively refresh the OAuth token — getBridgeSession uses raw axios
    // without the withOAuthRetry 401-refresh logic. An expired-but-present
    // token would otherwise produce a misleading "not found" error.
    await checkAndRefreshOAuthTokenIfNeeded()
    clearOAuthTokenCache()
    const { getBridgeSession } = await import('./createSession.js')
    const session = await getBridgeSession(resumeSessionId, {
      baseUrl,
      getAccessToken: getBridgeAccessToken,
    })
    if (!session) {
      // Session gone on server → pointer is stale. Clear it so the user
      // isn't re-prompted next launch. (Explicit --session-id leaves the
      // pointer alone — it's an independent file they may not even have.)
      // resumePointerDir may be a worktree sibling — clear THAT file.
      if (resumePointerDir) {
        const { clearBridgePointer } = await import('./bridgePointer.js')
        await clearBridgePointer(resumePointerDir)
      }
      // biome-ignore lint/suspicious/noConsole: intentional error output
      console.error(
        `Error: Session ${resumeSessionId} not found. It may have been archived or expired, or your login may have lapsed (run \`claude /login\`).`,
      )
      // eslint-disable-next-line custom-rules/no-process-exit
      process.exit(1)
    }
    if (!session.environment_id) {
      if (resumePointerDir) {
        const { clearBridgePointer } = await import('./bridgePointer.js')
        await clearBridgePointer(resumePointerDir)
      }
      // biome-ignore lint/suspicious/noConsole: intentional error output
      console.error(
        `Error: Session ${resumeSessionId} has no environment_id. It may never have been attached to a bridge.`,
      )
      // eslint-disable-next-line custom-rules/no-process-exit
      process.exit(1)
    }
    reuseEnvironmentId = session.environment_id
    logForDebugging(
      `[bridge:init] Resuming session ${resumeSessionId} on environment ${reuseEnvironmentId}`,
    )
  }

  const config: BridgeConfig = {
    dir,
    machineName,
    branch,
    gitRepoUrl,
    maxSessions,
    spawnMode,
    verbose,
    sandbox,
    bridgeId,
    workerType: 'claude_code',
    environmentId: randomUUID(),
    reuseEnvironmentId,
    apiBaseUrl: baseUrl,
    sessionIngressUrl,
    debugFile,
    sessionTimeoutMs,
  }

  logForDebugging(
    `[bridge:init] bridgeId=${bridgeId}${reuseEnvironmentId ? ` reuseEnvironmentId=${reuseEnvironmentId}` : ''} dir=${dir} branch=${branch} gitRepoUrl=${gitRepoUrl} machine=${machineName}`,
  )
  logForDebugging(
    `[bridge:init] apiBaseUrl=${baseUrl} sessionIngressUrl=${sessionIngressUrl}`,
  )
  logForDebugging(
    `[bridge:init] sandbox=${sandbox}${debugFile ? ` debugFile=${debugFile}` : ''}`,
  )

  // Register the bridge environment before entering the poll loop.
  let environmentId: string
  let environmentSecret: string
  try {
    const reg = await api.registerBridgeEnvironment(config)
    environmentId = reg.environment_id
    environmentSecret = reg.environment_secret
  } catch (err) {
    logEvent('tengu_bridge_registration_failed', {
      status: err instanceof BridgeFatalError ? err.status : undefined,
    })
    // Registration failures are fatal — print a clean message instead of a stack trace.
    // biome-ignore lint/suspicious/noConsole:: intentional console output
    console.error(
      err instanceof BridgeFatalError && err.status === 404
        ? 'Remote Control environments are not available for your account.'
        : `Error: ${errorMessage(err)}`,
    )
    // eslint-disable-next-line custom-rules/no-process-exit
    process.exit(1)
  }

  // Tracks whether the --session-id resume flow completed successfully.
  // Used below to skip fresh session creation and seed initialSessionId.
  // Cleared on env mismatch so we gracefully fall back to a new session.
  let effectiveResumeSessionId: string | undefined
  if (feature('KAIROS') && resumeSessionId) {
    if (reuseEnvironmentId && environmentId !== reuseEnvironmentId) {
      // Backend returned a different environment_id — the original env
      // expired or was reaped. Reconnect won't work against the new env
      // (session is bound to the old one). Log to sentry for visibility
      // and fall through to fresh session creation on the new env.
      logError(
        new Error(
          `Bridge resume env mismatch: requested ${reuseEnvironmentId}, backend returned ${environmentId}. Falling back to fresh session.`,
        ),
      )
      // biome-ignore lint/suspicious/noConsole: intentional warning output
      console.warn(
        `Warning: Could not resume session ${resumeSessionId} — its environment has expired. Creating a fresh session instead.`,
      )
      // Don't deregister — we're going to use this new environment.
      // effectiveResumeSessionId stays undefined → fresh session path below.
    } else {
      // Force-stop any stale worker instances for this session and re-queue
      // it so our poll loop picks it up. Must happen after registration so
      // the backend knows a live worker exists for the environment.
      //
      // The pointer stores a session_* ID but /bridge/reconnect looks
      // sessions up by their infra tag (cse_*) when ccr_v2_compat_enabled
      // is on. Try both; the conversion is a no-op if already cse_*.
      const infraResumeId = toInfraSessionId(resumeSessionId)
      const reconnectCandidates =
        infraResumeId === resumeSessionId
          ? [resumeSessionId]
          : [resumeSessionId, infraResumeId]
      let reconnected = false
      let lastReconnectErr: unknown
      for (const candidateId of reconnectCandidates) {
        try {
          await api.reconnectSession(environmentId, candidateId)
          logForDebugging(
            `[bridge:init] Session ${candidateId} re-queued via bridge/reconnect`,
          )
          effectiveResumeSessionId = resumeSessionId
          reconnected = true
          break
        } catch (err) {
          lastReconnectErr = err
          logForDebugging(
            `[bridge:init] reconnectSession(${candidateId}) failed: ${errorMessage(err)}`,
          )
        }
      }
      if (!reconnected) {
        const err = lastReconnectErr

        // Do NOT deregister on transient reconnect failure — at this point
        // environmentId IS the session's own environment. Deregistering
        // would make retry impossible. The backend's 4h TTL cleans up.
        const isFatal = err instanceof BridgeFatalError
        // Clear pointer only on fatal reconnect failure. Transient failures
        // ("try running the same command again") should keep the pointer so
        // next launch re-prompts — that IS the retry mechanism.
        if (resumePointerDir && isFatal) {
          const { clearBridgePointer } = await import('./bridgePointer.js')
          await clearBridgePointer(resumePointerDir)
        }
        // biome-ignore lint/suspicious/noConsole: intentional error output
        console.error(
          isFatal
            ? `Error: ${errorMessage(err)}`
            : `Error: Failed to reconnect session ${resumeSessionId}: ${errorMessage(err)}\nThe session may still be resumable — try running the same command again.`,
        )
        // eslint-disable-next-line custom-rules/no-process-exit
        process.exit(1)
      }
    }
  }

  logForDebugging(
    `[bridge:init] Registered, server environmentId=${environmentId}`,
  )
  const startupPollConfig = getPollIntervalConfig()
  logEvent('tengu_bridge_started', {
    max_sessions: config.maxSessions,
    has_debug_file: !!config.debugFile,
    sandbox: config.sandbox,
    verbose: config.verbose,
    heartbeat_interval_ms:
      startupPollConfig.non_exclusive_heartbeat_interval_ms,
    spawn_mode:
      config.spawnMode as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    spawn_mode_source:
      spawnModeSource as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    multi_session_gate: multiSessionEnabled,
    pre_create_session: preCreateSession,
    worktree_available: worktreeAvailable,
  })
  logForDiagnosticsNoPII('info', 'bridge_started', {
    max_sessions: config.maxSessions,
    sandbox: config.sandbox,
    spawn_mode: config.spawnMode,
  })

  const spawner = createSessionSpawner({
    execPath: process.execPath,
    scriptArgs: spawnScriptArgs(),
    env: process.env,
    verbose,
    sandbox,
    debugFile,
    permissionMode,
    onDebug: logForDebugging,
    onActivity: (sessionId, activity) => {
      logForDebugging(
        `[bridge:activity] sessionId=${sessionId} ${activity.type} ${activity.summary}`,
      )
    },
    onPermissionRequest: (sessionId, request, _accessToken) => {
      logForDebugging(
        `[bridge:perm] sessionId=${sessionId} tool=${request.request.tool_name} request_id=${request.request_id} (not auto-approving)`,
      )
    },
  })

  const logger = createBridgeLogger({ verbose })
  const { parseGitHubRepository } = await import('../utils/detectRepository.js')
  const ownerRepo = gitRepoUrl ? parseGitHubRepository(gitRepoUrl) : null
  // Use the repo name from the parsed owner/repo, or fall back to the dir basename
  const repoName = ownerRepo ? ownerRepo.split('/').pop()! : basename(dir)
  logger.setRepoInfo(repoName, branch)

  // `w` toggle is available iff we're in a multi-session mode AND worktree
  // is a valid option. When unavailable, the mode suffix and hint are hidden.
  const toggleAvailable = spawnMode !== 'single-session' && worktreeAvailable
  if (toggleAvailable) {
    // Safe cast: spawnMode is not single-session (checked above), and the
    // saved-worktree-in-non-git guard + exit check above ensure worktree
    // is only reached when available.
    logger.setSpawnModeDisplay(spawnMode as 'same-dir' | 'worktree')
  }

  // Listen for keys: space toggles QR code, w toggles spawn mode
  const onStdinData = (data: Buffer): void => {
    if (data[0] === 0x03 || data[0] === 0x04) {
      // Ctrl+C / Ctrl+D — trigger graceful shutdown
      process.emit('SIGINT')
      return
    }
    if (data[0] === 0x20 /* space */) {
      logger.toggleQr()
      return
    }
    if (data[0] === 0x77 /* 'w' */) {
      if (!toggleAvailable) return
      const newMode: 'same-dir' | 'worktree' =
        config.spawnMode === 'same-dir' ? 'worktree' : 'same-dir'
      config.spawnMode = newMode
      logEvent('tengu_bridge_spawn_mode_toggled', {
        spawn_mode:
          newMode as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      })
      logger.logStatus(
        newMode === 'worktree'
          ? 'Spawn mode: worktree (new sessions get isolated git worktrees)'
          : 'Spawn mode: same-dir (new sessions share the current directory)',
      )
      logger.setSpawnModeDisplay(newMode)
      logger.refreshDisplay()
      saveCurrentProjectConfig(current => {
        if (current.remoteControlSpawnMode === newMode) return current
        return { ...current, remoteControlSpawnMode: newMode }
      })
      return
    }
  }
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', onStdinData)
  }

  const controller = new AbortController()
  const onSigint = (): void => {
    logForDebugging('[bridge:shutdown] SIGINT received, shutting down')
    controller.abort()
  }
  const onSigterm = (): void => {
    logForDebugging('[bridge:shutdown] SIGTERM received, shutting down')
    controller.abort()
  }
  process.on('SIGINT', onSigint)
  process.on('SIGTERM', onSigterm)

  // Auto-create an empty session so the user has somewhere to type
  // immediately (matching /remote-control behavior). Controlled by
  // preCreateSession: on by default; --no-create-session-in-dir opts out.
  // When a --session-id resume succeeded, skip creation entirely — the
  // session already exists and bridge/reconnect has re-queued it.
  // When resume was requested but failed on env mismatch, effectiveResumeSessionId
  // is undefined, so we fall through to fresh session creation (honoring the
  // "Creating a fresh session instead" warning printed above).
  let initialSessionId: string | null =
    feature('KAIROS') && effectiveResumeSessionId
      ? effectiveResumeSessionId
      : null
  if (preCreateSession && !(feature('KAIROS') && effectiveResumeSessionId)) {
    const { createBridgeSession } = await import('./createSession.js')
    try {
      initialSessionId = await createBridgeSession({
        environmentId,
        title: name,
        events: [],
        gitRepoUrl,
        branch,
        signal: controller.signal,
        baseUrl,
        getAccessToken: getBridgeAccessToken,
        permissionMode,
      })
      if (initialSessionId) {
        logForDebugging(
          `[bridge:init] Created initial session ${initialSessionId}`,
        )
      }
    } catch (err) {
      logForDebugging(
        `[bridge:init] Session creation failed (non-fatal): ${errorMessage(err)}`,
      )
    }
  }

  // Crash-recovery pointer: write immediately so kill -9 at any point
  // after this leaves a recoverable trail. Covers both fresh sessions and
  // resumed ones (so a second crash after resume is still recoverable).
  // Cleared when runBridgeLoop falls through to archive+deregister; left in
  // place on the SIGINT resumable-shutdown return (backup for when the user
  // closes the terminal before copying the printed --session-id hint).
  // Refreshed hourly so a 5h+ session that crashes still has a fresh
  // pointer (staleness checks file mtime, backend TTL is rolling-from-poll).
  let pointerRefreshTimer: ReturnType<typeof setInterval> | null = null
  // Single-session only: --continue forces single-session mode on resume,
  // so a pointer written in multi-session mode would contradict the user's
  // config when they try to resume. The resumable-shutdown path is also
  // gated to single-session (line ~1254) so the pointer would be orphaned.
  if (initialSessionId && spawnMode === 'single-session') {
    const { writeBridgePointer } = await import('./bridgePointer.js')
    const pointerPayload = {
      sessionId: initialSessionId,
      environmentId,
      source: 'standalone' as const,
    }
    await writeBridgePointer(config.dir, pointerPayload)
    pointerRefreshTimer = setInterval(
      writeBridgePointer,
      60 * 60 * 1000,
      config.dir,
      pointerPayload,
    )
    // Don't let the interval keep the process alive on its own.
    pointerRefreshTimer.unref?.()
  }

  try {
    await runBridgeLoop(
      config,
      environmentId,
      environmentSecret,
      api,
      spawner,
      logger,
      controller.signal,
      undefined,
      initialSessionId ?? undefined,
      async () => {
        // Clear the memoized OAuth token cache so we re-read from secure
        // storage, picking up tokens refreshed by child processes.
        clearOAuthTokenCache()
        // Proactively refresh the token if it's expired on disk too.
        await checkAndRefreshOAuthTokenIfNeeded()
        return getBridgeAccessToken()
      },
    )
  } finally {
    if (pointerRefreshTimer !== null) {
      clearInterval(pointerRefreshTimer)
    }
    process.off('SIGINT', onSigint)
    process.off('SIGTERM', onSigterm)
    process.stdin.off('data', onStdinData)
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false)
    }
    process.stdin.pause()
  }

  // The bridge bypasses init.ts (and its graceful shutdown handler), so we
  // must exit explicitly.
  // eslint-disable-next-line custom-rules/no-process-exit
  process.exit(0)
}

// ─── Headless bridge (daemon worker) ────────────────────────────────────────

/**
 * Thrown by runBridgeHeadless for configuration issues the supervisor should
 * NOT retry (trust not accepted, worktree unavailable, http-not-https). The
 * daemon worker catches this and exits with EXIT_CODE_PERMANENT so the
 * supervisor parks the worker instead of respawning it on backoff.
 */
export class BridgeHeadlessPermanentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BridgeHeadlessPermanentError'
  }
}

export type HeadlessBridgeOpts = {
  dir: string
  name?: string
  spawnMode: 'same-dir' | 'worktree'
  capacity: number
  permissionMode?: string
  sandbox: boolean
  sessionTimeoutMs?: number
  createSessionOnStart: boolean
  getAccessToken: () => string | undefined
  onAuth401: (failedToken: string) => Promise<boolean>
  log: (s: string) => void
}

/**
 * Non-interactive bridge entrypoint for the `remoteControl` daemon worker.
 *
 * Linear subset of bridgeMain(): no readline dialogs, no stdin key handlers,
 * no TUI, no process.exit(). Config comes from the caller (daemon.json), auth
 * comes via IPC (supervisor's AuthManager), logs go to the worker's stdout
 * pipe. Throws on fatal errors — the worker catches and maps permanent vs
 * transient to the right exit code.
 *
 * Resolves cleanly when `signal` aborts and the poll loop tears down.
 */
export async function runBridgeHeadless(
  opts: HeadlessBridgeOpts,
  signal: AbortSignal,
): Promise<void> {
  const { dir, log } = opts

  // Worker inherits the supervisor's CWD. chdir first so git utilities
  // (getBranch/getRemoteUrl) — which read from bootstrap CWD state set
  // below — resolve against the right repo.
  process.chdir(dir)
  const { setOriginalCwd, setCwdState } = await import('../bootstrap/state.js')
  setOriginalCwd(dir)
  setCwdState(dir)

  const { enableConfigs, checkHasTrustDialogAccepted } = await import(
    '../utils/config.js'
  )
  enableConfigs()
  const { initSinks } = await import('../utils/sinks.js')
  initSinks()

  if (!checkHasTrustDialogAccepted()) {
    throw new BridgeHeadlessPermanentError(
      `Workspace not trusted: ${dir}. Run \`claude\` in that directory first to accept the trust dialog.`,
    )
  }

  if (!opts.getAccessToken()) {
    // Transient — supervisor's AuthManager may pick up a token on next cycle.
    throw new Error(BRIDGE_LOGIN_ERROR)
  }

  const { getBridgeBaseUrl } = await import('./bridgeConfig.js')
  const baseUrl = getBridgeBaseUrl()
  if (
    baseUrl.startsWith('http://') &&
    !baseUrl.includes('localhost') &&
    !baseUrl.includes('127.0.0.1')
  ) {
    throw new BridgeHeadlessPermanentError(
      'Remote Control base URL uses HTTP. Only HTTPS or localhost HTTP is allowed.',
    )
  }
  const sessionIngressUrl =
    process.env.USER_TYPE === 'ant' &&
    process.env.CLAUDE_BRIDGE_SESSION_INGRESS_URL
      ? process.env.CLAUDE_BRIDGE_SESSION_INGRESS_URL
      : baseUrl

  const { getBranch, getRemoteUrl, findGitRoot } = await import(
    '../utils/git.js'
  )
  const { hasWorktreeCreateHook } = await import('../utils/hooks.js')

  if (opts.spawnMode === 'worktree') {
    const worktreeAvailable =
      hasWorktreeCreateHook() || findGitRoot(dir) !== null
    if (!worktreeAvailable) {
      throw new BridgeHeadlessPermanentError(
        `Worktree mode requires a git repository or WorktreeCreate hooks. Directory ${dir} has neither.`,
      )
    }
  }

  const branch = await getBranch()
  const gitRepoUrl = await getRemoteUrl()
  const machineName = hostname()
  const bridgeId = randomUUID()

  const config: BridgeConfig = {
    dir,
    machineName,
    branch,
    gitRepoUrl,
    maxSessions: opts.capacity,
    spawnMode: opts.spawnMode,
    verbose: false,
    sandbox: opts.sandbox,
    bridgeId,
    workerType: 'claude_code',
    environmentId: randomUUID(),
    apiBaseUrl: baseUrl,
    sessionIngressUrl,
    sessionTimeoutMs: opts.sessionTimeoutMs,
  }

  const api = createBridgeApiClient({
    baseUrl,
    getAccessToken: opts.getAccessToken,
    runnerVersion: MACRO.VERSION,
    onDebug: log,
    onAuth401: opts.onAuth401,
    getTrustedDeviceToken,
  })

  let environmentId: string
  let environmentSecret: string
  try {
    const reg = await api.registerBridgeEnvironment(config)
    environmentId = reg.environment_id
    environmentSecret = reg.environment_secret
  } catch (err) {
    // Transient — let supervisor backoff-retry.
    throw new Error(`Bridge registration failed: ${errorMessage(err)}`)
  }

  const spawner = createSessionSpawner({
    execPath: process.execPath,
    scriptArgs: spawnScriptArgs(),
    env: process.env,
    verbose: false,
    sandbox: opts.sandbox,
    permissionMode: opts.permissionMode,
    onDebug: log,
  })

  const logger = createHeadlessBridgeLogger(log)
  logger.printBanner(config, environmentId)

  let initialSessionId: string | undefined
  if (opts.createSessionOnStart) {
    const { createBridgeSession } = await import('./createSession.js')
    try {
      const sid = await createBridgeSession({
        environmentId,
        title: opts.name,
        events: [],
        gitRepoUrl,
        branch,
        signal,
        baseUrl,
        getAccessToken: opts.getAccessToken,
        permissionMode: opts.permissionMode,
      })
      if (sid) {
        initialSessionId = sid
        log(`created initial session ${sid}`)
      }
    } catch (err) {
      log(`session pre-creation failed (non-fatal): ${errorMessage(err)}`)
    }
  }

  await runBridgeLoop(
    config,
    environmentId,
    environmentSecret,
    api,
    spawner,
    logger,
    signal,
    undefined,
    initialSessionId,
    async () => opts.getAccessToken(),
  )
}

/** BridgeLogger adapter that routes everything to a single line-log fn. */
function createHeadlessBridgeLogger(log: (s: string) => void): BridgeLogger {
  const noop = (): void => {}
  return {
    printBanner: (cfg, envId) =>
      log(
        `registered environmentId=${envId} dir=${cfg.dir} spawnMode=${cfg.spawnMode} capacity=${cfg.maxSessions}`,
      ),
    logSessionStart: (id, _prompt) => log(`session start ${id}`),
    logSessionComplete: (id, ms) => log(`session complete ${id} (${ms}ms)`),
    logSessionFailed: (id, err) => log(`session failed ${id}: ${err}`),
    logStatus: log,
    logVerbose: log,
    logError: s => log(`error: ${s}`),
    logReconnected: ms => log(`reconnected after ${ms}ms`),
    addSession: (id, _url) => log(`session attached ${id}`),
    removeSession: id => log(`session detached ${id}`),
    updateIdleStatus: noop,
    updateReconnectingStatus: noop,
    updateSessionStatus: noop,
    updateSessionActivity: noop,
    updateSessionCount: noop,
    updateFailedStatus: noop,
    setSpawnModeDisplay: noop,
    setRepoInfo: noop,
    setDebugLogPath: noop,
    setAttached: noop,
    setSessionTitle: noop,
    clearStatus: noop,
    toggleQr: noop,
    refreshDisplay: noop,
  }
}
