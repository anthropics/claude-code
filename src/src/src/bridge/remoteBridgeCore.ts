// biome-ignore-all assist/source/organizeImports: ANT-ONLY import markers must not be reordered
/**
 * Env-less Remote Control bridge core.
 *
 * "Env-less" = no Environments API layer. Distinct from "CCR v2" (the
 * /worker/* transport protocol) — the env-based path (replBridge.ts) can also
 * use CCR v2 transport via CLAUDE_CODE_USE_CCR_V2. This file is about removing
 * the poll/dispatch layer, not about which transport protocol is underneath.
 *
 * Unlike initBridgeCore (env-based, ~2400 lines), this connects directly
 * to the session-ingress layer without the Environments API work-dispatch
 * layer:
 *
 *   1. POST /v1/code/sessions              (OAuth, no env_id)  → session.id
 *   2. POST /v1/code/sessions/{id}/bridge  (OAuth)             → {worker_jwt, expires_in, api_base_url, worker_epoch}
 *      Each /bridge call bumps epoch — it IS the register. No separate /worker/register.
 *   3. createV2ReplTransport(worker_jwt, worker_epoch)         → SSE + CCRClient
 *   4. createTokenRefreshScheduler                             → proactive /bridge re-call (new JWT + new epoch)
 *   5. 401 on SSE → rebuild transport with fresh /bridge credentials (same seq-num)
 *
 * No register/poll/ack/stop/heartbeat/deregister environment lifecycle.
 * The Environments API historically existed because CCR's /worker/*
 * endpoints required a session_id+role=worker JWT that only the work-dispatch
 * layer could mint. Server PR #292605 (renamed in #293280) adds the /bridge endpoint as a direct
 * OAuth→worker_jwt exchange, making the env layer optional for REPL sessions.
 *
 * Gated by `tengu_bridge_repl_v2` GrowthBook flag in initReplBridge.ts.
 * REPL-only — daemon/print stay on env-based.
 */

import { feature } from 'bun:bundle'
import axios from 'axios'
import {
  createV2ReplTransport,
  type ReplBridgeTransport,
} from './replBridgeTransport.js'
import { buildCCRv2SdkUrl } from './workSecret.js'
import { toCompatSessionId } from './sessionIdCompat.js'
import { FlushGate } from './flushGate.js'
import { createTokenRefreshScheduler } from './jwtUtils.js'
import { getTrustedDeviceToken } from './trustedDevice.js'
import {
  getEnvLessBridgeConfig,
  type EnvLessBridgeConfig,
} from './envLessBridgeConfig.js'
import {
  handleIngressMessage,
  handleServerControlRequest,
  makeResultMessage,
  isEligibleBridgeMessage,
  extractTitleText,
  BoundedUUIDSet,
} from './bridgeMessaging.js'
import { logBridgeSkip } from './debugUtils.js'
import { logForDebugging } from '../utils/debug.js'
import { logForDiagnosticsNoPII } from '../utils/diagLogs.js'
import { isInProtectedNamespace } from '../utils/envUtils.js'
import { errorMessage } from '../utils/errors.js'
import { sleep } from '../utils/sleep.js'
import { registerCleanup } from '../utils/cleanupRegistry.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../services/analytics/index.js'
import type { ReplBridgeHandle, BridgeState } from './replBridge.js'
import type { Message } from '../types/message.js'
import type { SDKMessage } from '../entrypoints/agentSdkTypes.js'
import type {
  SDKControlRequest,
  SDKControlResponse,
} from '../entrypoints/sdk/controlTypes.js'
import type { PermissionMode } from '../utils/permissions/PermissionMode.js'

const ANTHROPIC_VERSION = '2023-06-01'

// Telemetry discriminator for ws_connected. 'initial' is the default and
// never passed to rebuildTransport (which can only be called post-init);
// Exclude<> makes that constraint explicit at both signatures.
type ConnectCause = 'initial' | 'proactive_refresh' | 'auth_401_recovery'

function oauthHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'anthropic-version': ANTHROPIC_VERSION,
  }
}

export type EnvLessBridgeParams = {
  baseUrl: string
  orgUUID: string
  title: string
  getAccessToken: () => string | undefined
  onAuth401?: (staleAccessToken: string) => Promise<boolean>
  /**
   * Converts internal Message[] → SDKMessage[] for writeMessages() and the
   * initial-flush/drain paths. Injected rather than imported — mappers.ts
   * transitively pulls in src/commands.ts (entire command registry + React
   * tree) which would bloat bundles that don't already have it.
   */
  toSDKMessages: (messages: Message[]) => SDKMessage[]
  initialHistoryCap: number
  initialMessages?: Message[]
  onInboundMessage?: (msg: SDKMessage) => void | Promise<void>
  /**
   * Fired on each title-worthy user message seen in writeMessages() until
   * the callback returns true (done). Mirrors replBridge.ts's onUserMessage —
   * caller derives a title and PATCHes /v1/sessions/{id} so auto-started
   * sessions don't stay at the generic fallback. The caller owns the
   * derive-at-count-1-and-3 policy; the transport just keeps calling until
   * told to stop. sessionId is the raw cse_* — updateBridgeSessionTitle
   * retags internally.
   */
  onUserMessage?: (text: string, sessionId: string) => boolean
  onPermissionResponse?: (response: SDKControlResponse) => void
  onInterrupt?: () => void
  onSetModel?: (model: string | undefined) => void
  onSetMaxThinkingTokens?: (maxTokens: number | null) => void
  onSetPermissionMode?: (
    mode: PermissionMode,
  ) => { ok: true } | { ok: false; error: string }
  onStateChange?: (state: BridgeState, detail?: string) => void
  /**
   * When true, skip opening the SSE read stream — only the CCRClient write
   * path is activated. Threaded to createV2ReplTransport and
   * handleServerControlRequest.
   */
  outboundOnly?: boolean
  /** Free-form tags for session categorization (e.g. ['ccr-mirror']). */
  tags?: string[]
}

/**
 * Create a session, fetch a worker JWT, connect the v2 transport.
 *
 * Returns null on any pre-flight failure (session create failed, /bridge
 * failed, transport setup failed). Caller (initReplBridge) surfaces this
 * as a generic "initialization failed" state.
 */
export async function initEnvLessBridgeCore(
  params: EnvLessBridgeParams,
): Promise<ReplBridgeHandle | null> {
  const {
    baseUrl,
    orgUUID,
    title,
    getAccessToken,
    onAuth401,
    toSDKMessages,
    initialHistoryCap,
    initialMessages,
    onInboundMessage,
    onUserMessage,
    onPermissionResponse,
    onInterrupt,
    onSetModel,
    onSetMaxThinkingTokens,
    onSetPermissionMode,
    onStateChange,
    outboundOnly,
    tags,
  } = params

  const cfg = await getEnvLessBridgeConfig()

  // ── 1. Create session (POST /v1/code/sessions, no env_id) ───────────────
  const accessToken = getAccessToken()
  if (!accessToken) {
    logForDebugging('[remote-bridge] No OAuth token')
    return null
  }

  const createdSessionId = await withRetry(
    () =>
      createCodeSession(baseUrl, accessToken, title, cfg.http_timeout_ms, tags),
    'createCodeSession',
    cfg,
  )
  if (!createdSessionId) {
    onStateChange?.('failed', 'Session creation failed — see debug log')
    logBridgeSkip('v2_session_create_failed', undefined, true)
    return null
  }
  const sessionId: string = createdSessionId
  logForDebugging(`[remote-bridge] Created session ${sessionId}`)
  logForDiagnosticsNoPII('info', 'bridge_repl_v2_session_created')

  // ── 2. Fetch bridge credentials (POST /bridge → worker_jwt, expires_in, api_base_url) ──
  const credentials = await withRetry(
    () =>
      fetchRemoteCredentials(
        sessionId,
        baseUrl,
        accessToken,
        cfg.http_timeout_ms,
      ),
    'fetchRemoteCredentials',
    cfg,
  )
  if (!credentials) {
    onStateChange?.('failed', 'Remote credentials fetch failed — see debug log')
    logBridgeSkip('v2_remote_creds_failed', undefined, true)
    void archiveSession(
      sessionId,
      baseUrl,
      accessToken,
      orgUUID,
      cfg.http_timeout_ms,
    )
    return null
  }
  logForDebugging(
    `[remote-bridge] Fetched bridge credentials (expires_in=${credentials.expires_in}s)`,
  )

  // ── 3. Build v2 transport (SSETransport + CCRClient) ────────────────────
  const sessionUrl = buildCCRv2SdkUrl(credentials.api_base_url, sessionId)
  logForDebugging(`[remote-bridge] v2 session URL: ${sessionUrl}`)

  let transport: ReplBridgeTransport
  try {
    transport = await createV2ReplTransport({
      sessionUrl,
      ingressToken: credentials.worker_jwt,
      sessionId,
      epoch: credentials.worker_epoch,
      heartbeatIntervalMs: cfg.heartbeat_interval_ms,
      heartbeatJitterFraction: cfg.heartbeat_jitter_fraction,
      // Per-instance closure — keeps the worker JWT out of
      // process.env.CLAUDE_CODE_SESSION_ACCESS_TOKEN, which mcp/client.ts
      // reads ungatedly and would otherwise send to user-configured ws/http
      // MCP servers. Frozen-at-construction is correct: transport is fully
      // rebuilt on refresh (rebuildTransport below).
      getAuthToken: () => credentials.worker_jwt,
      outboundOnly,
    })
  } catch (err) {
    logForDebugging(
      `[remote-bridge] v2 transport setup failed: ${errorMessage(err)}`,
      { level: 'error' },
    )
    onStateChange?.('failed', `Transport setup failed: ${errorMessage(err)}`)
    logBridgeSkip('v2_transport_setup_failed', undefined, true)
    void archiveSession(
      sessionId,
      baseUrl,
      accessToken,
      orgUUID,
      cfg.http_timeout_ms,
    )
    return null
  }
  logForDebugging(
    `[remote-bridge] v2 transport created (epoch=${credentials.worker_epoch})`,
  )
  onStateChange?.('ready')

  // ── 4. State ────────────────────────────────────────────────────────────

  // Echo dedup: messages we POST come back on the read stream. Seeded with
  // initial message UUIDs so server echoes of flushed history are recognized.
  // Both sets cover initial UUIDs — recentPostedUUIDs is a 2000-cap ring buffer
  // and could evict them after enough live writes; initialMessageUUIDs is the
  // unbounded fallback. Defense-in-depth; mirrors replBridge.ts.
  const recentPostedUUIDs = new BoundedUUIDSet(cfg.uuid_dedup_buffer_size)
  const initialMessageUUIDs = new Set<string>()
  if (initialMessages) {
    for (const msg of initialMessages) {
      initialMessageUUIDs.add(msg.uuid)
      recentPostedUUIDs.add(msg.uuid)
    }
  }

  // Defensive dedup for re-delivered inbound prompts (seq-num negotiation
  // edge cases, server history replay after transport swap).
  const recentInboundUUIDs = new BoundedUUIDSet(cfg.uuid_dedup_buffer_size)

  // FlushGate: queue live writes while the history flush POST is in flight,
  // so the server receives [history..., live...] in order.
  const flushGate = new FlushGate<Message>()

  let initialFlushDone = false
  let tornDown = false
  let authRecoveryInFlight = false
  // Latch for onUserMessage — flips true when the callback returns true
  // (policy says "done deriving"). sessionId is const (no re-create path —
  // rebuildTransport swaps JWT/epoch, same session), so no reset needed.
  let userMessageCallbackDone = !onUserMessage

  // Telemetry: why did onConnect fire? Set by rebuildTransport before
  // wireTransportCallbacks; read asynchronously by onConnect. Race-safe
  // because authRecoveryInFlight serializes rebuild callers, and a fresh
  // initEnvLessBridgeCore() call gets a fresh closure defaulting to 'initial'.
  let connectCause: ConnectCause = 'initial'

  // Deadline for onConnect after transport.connect(). Cleared by onConnect
  // (connected) and onClose (got a close — not silent). If neither fires
  // before cfg.connect_timeout_ms, onConnectTimeout emits — the only
  // signal for the `started → (silence)` gap.
  let connectDeadline: ReturnType<typeof setTimeout> | undefined
  function onConnectTimeout(cause: ConnectCause): void {
    if (tornDown) return
    logEvent('tengu_bridge_repl_connect_timeout', {
      v2: true,
      elapsed_ms: cfg.connect_timeout_ms,
      cause:
        cause as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
  }

  // ── 5. JWT refresh scheduler ────────────────────────────────────────────
  // Schedule a callback 5min before expiry (per response.expires_in). On fire,
  // re-fetch /bridge with OAuth → rebuild transport with fresh credentials.
  // Each /bridge call bumps epoch server-side, so a JWT-only swap would leave
  // the old CCRClient heartbeating with a stale epoch → 409 within 20s.
  // JWT is opaque — do not decode.
  const refresh = createTokenRefreshScheduler({
    refreshBufferMs: cfg.token_refresh_buffer_ms,
    getAccessToken: async () => {
      // Unconditionally refresh OAuth before calling /bridge — getAccessToken()
      // returns expired tokens as non-null strings (doesn't check expiresAt),
      // so truthiness doesn't mean valid. Pass the stale token to onAuth401
      // so handleOAuth401Error's keychain-comparison can detect parallel refresh.
      const stale = getAccessToken()
      if (onAuth401) await onAuth401(stale ?? '')
      return getAccessToken() ?? stale
    },
    onRefresh: (sid, oauthToken) => {
      void (async () => {
        // Laptop wake: overdue proactive timer + SSE 401 fire ~simultaneously.
        // Claim the flag BEFORE the /bridge fetch so the other path skips
        // entirely — prevents double epoch bump (each /bridge call bumps; if
        // both fetch, the first rebuild gets a stale epoch and 409s).
        if (authRecoveryInFlight || tornDown) {
          logForDebugging(
            '[remote-bridge] Recovery already in flight, skipping proactive refresh',
          )
          return
        }
        authRecoveryInFlight = true
        try {
          const fresh = await withRetry(
            () =>
              fetchRemoteCredentials(
                sid,
                baseUrl,
                oauthToken,
                cfg.http_timeout_ms,
              ),
            'fetchRemoteCredentials (proactive)',
            cfg,
          )
          if (!fresh || tornDown) return
          await rebuildTransport(fresh, 'proactive_refresh')
          logForDebugging(
            '[remote-bridge] Transport rebuilt (proactive refresh)',
          )
        } catch (err) {
          logForDebugging(
            `[remote-bridge] Proactive refresh rebuild failed: ${errorMessage(err)}`,
            { level: 'error' },
          )
          logForDiagnosticsNoPII(
            'error',
            'bridge_repl_v2_proactive_refresh_failed',
          )
          if (!tornDown) {
            onStateChange?.('failed', `Refresh failed: ${errorMessage(err)}`)
          }
        } finally {
          authRecoveryInFlight = false
        }
      })()
    },
    label: 'remote',
  })
  refresh.scheduleFromExpiresIn(sessionId, credentials.expires_in)

  // ── 6. Wire callbacks (extracted so transport-rebuild can re-wire) ──────
  function wireTransportCallbacks(): void {
    transport.setOnConnect(() => {
      clearTimeout(connectDeadline)
      logForDebugging('[remote-bridge] v2 transport connected')
      logForDiagnosticsNoPII('info', 'bridge_repl_v2_transport_connected')
      logEvent('tengu_bridge_repl_ws_connected', {
        v2: true,
        cause:
          connectCause as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      })

      if (!initialFlushDone && initialMessages && initialMessages.length > 0) {
        initialFlushDone = true
        // Capture current transport — if 401/teardown happens mid-flush,
        // the stale .finally() must not drain the gate or signal connected.
        // (Same guard pattern as replBridge.ts:1119.)
        const flushTransport = transport
        void flushHistory(initialMessages)
          .catch(e =>
            logForDebugging(`[remote-bridge] flushHistory failed: ${e}`),
          )
          .finally(() => {
            // authRecoveryInFlight catches the v1-vs-v2 asymmetry: v1 nulls
            // transport synchronously in setOnClose (replBridge.ts:1175), so
            // transport !== flushTransport trips immediately. v2 doesn't null —
            // transport reassigned only at rebuildTransport:346, 3 awaits deep.
            // authRecoveryInFlight is set synchronously at rebuildTransport entry.
            if (
              transport !== flushTransport ||
              tornDown ||
              authRecoveryInFlight
            ) {
              return
            }
            drainFlushGate()
            onStateChange?.('connected')
          })
      } else if (!flushGate.active) {
        onStateChange?.('connected')
      }
    })

    transport.setOnData((data: string) => {
      handleIngressMessage(
        data,
        recentPostedUUIDs,
        recentInboundUUIDs,
        onInboundMessage,
        // Remote client answered the permission prompt — the turn resumes.
        // Without this the server stays on requires_action until the next
        // user message or turn-end result.
        onPermissionResponse
          ? res => {
              transport.reportState('running')
              onPermissionResponse(res)
            }
          : undefined,
        req =>
          handleServerControlRequest(req, {
            transport,
            sessionId,
            onInterrupt,
            onSetModel,
            onSetMaxThinkingTokens,
            onSetPermissionMode,
            outboundOnly,
          }),
      )
    })

    transport.setOnClose((code?: number) => {
      clearTimeout(connectDeadline)
      if (tornDown) return
      logForDebugging(`[remote-bridge] v2 transport closed (code=${code})`)
      logEvent('tengu_bridge_repl_ws_closed', { code, v2: true })
      // onClose fires only for TERMINAL failures: 401 (JWT invalid),
      // 4090 (CCR epoch mismatch), 4091 (CCR init failed), or SSE 10-min
      // reconnect budget exhausted. Transient disconnects are handled
      // transparently inside SSETransport. 401 we can recover from (fetch
      // fresh JWT, rebuild transport); all other codes are dead-ends.
      if (code === 401 && !authRecoveryInFlight) {
        void recoverFromAuthFailure()
        return
      }
      onStateChange?.('failed', `Transport closed (code ${code})`)
    })
  }

  // ── 7. Transport rebuild (shared by proactive refresh + 401 recovery) ──
  // Every /bridge call bumps epoch server-side. Both refresh paths must
  // rebuild the transport with the new epoch — a JWT-only swap leaves the
  // old CCRClient heartbeating stale epoch → 409. SSE resumes from the old
  // transport's high-water-mark seq-num so no server-side replay.
  // Caller MUST set authRecoveryInFlight = true before calling (synchronously,
  // before any await) and clear it in a finally. This function doesn't manage
  // the flag — moving it here would be too late to prevent a double /bridge
  // fetch, and each fetch bumps epoch.
  async function rebuildTransport(
    fresh: RemoteCredentials,
    cause: Exclude<ConnectCause, 'initial'>,
  ): Promise<void> {
    connectCause = cause
    // Queue writes during rebuild — once /bridge returns, the old transport's
    // epoch is stale and its next write/heartbeat 409s. Without this gate,
    // writeMessages adds UUIDs to recentPostedUUIDs then writeBatch silently
    // no-ops (closed uploader after 409) → permanent silent message loss.
    flushGate.start()
    try {
      const seq = transport.getLastSequenceNum()
      transport.close()
      transport = await createV2ReplTransport({
        sessionUrl: buildCCRv2SdkUrl(fresh.api_base_url, sessionId),
        ingressToken: fresh.worker_jwt,
        sessionId,
        epoch: fresh.worker_epoch,
        heartbeatIntervalMs: cfg.heartbeat_interval_ms,
        heartbeatJitterFraction: cfg.heartbeat_jitter_fraction,
        initialSequenceNum: seq,
        getAuthToken: () => fresh.worker_jwt,
        outboundOnly,
      })
      if (tornDown) {
        // Teardown fired during the async createV2ReplTransport window.
        // Don't wire/connect/schedule — we'd re-arm timers after cancelAll()
        // and fire onInboundMessage into a torn-down bridge.
        transport.close()
        return
      }
      wireTransportCallbacks()
      transport.connect()
      connectDeadline = setTimeout(
        onConnectTimeout,
        cfg.connect_timeout_ms,
        connectCause,
      )
      refresh.scheduleFromExpiresIn(sessionId, fresh.expires_in)
      // Drain queued writes into the new uploader. Runs before
      // ccr.initialize() resolves (transport.connect() is fire-and-forget),
      // but the uploader serializes behind the initial PUT /worker. If
      // init fails (4091), events drop — but only recentPostedUUIDs
      // (per-instance) is populated, so re-enabling the bridge re-flushes.
      drainFlushGate()
    } finally {
      // End the gate on failure paths too — drainFlushGate already ended
      // it on success. Queued messages are dropped (transport still dead).
      flushGate.drop()
    }
  }

  // ── 8. 401 recovery (OAuth refresh + rebuild) ───────────────────────────
  async function recoverFromAuthFailure(): Promise<void> {
    // setOnClose already guards `!authRecoveryInFlight` but that check and
    // this set must be atomic against onRefresh — claim synchronously before
    // any await. Laptop wake fires both paths ~simultaneously.
    if (authRecoveryInFlight) return
    authRecoveryInFlight = true
    onStateChange?.('reconnecting', 'JWT expired — refreshing')
    logForDebugging('[remote-bridge] 401 on SSE — attempting JWT refresh')
    try {
      // Unconditionally try OAuth refresh — getAccessToken() returns expired
      // tokens as non-null strings, so !oauthToken doesn't catch expiry.
      // Pass the stale token so handleOAuth401Error's keychain-comparison
      // can detect if another tab already refreshed.
      const stale = getAccessToken()
      if (onAuth401) await onAuth401(stale ?? '')
      const oauthToken = getAccessToken() ?? stale
      if (!oauthToken || tornDown) {
        if (!tornDown) {
          onStateChange?.('failed', 'JWT refresh failed: no OAuth token')
        }
        return
      }

      const fresh = await withRetry(
        () =>
          fetchRemoteCredentials(
            sessionId,
            baseUrl,
            oauthToken,
            cfg.http_timeout_ms,
          ),
        'fetchRemoteCredentials (recovery)',
        cfg,
      )
      if (!fresh || tornDown) {
        if (!tornDown) {
          onStateChange?.('failed', 'JWT refresh failed after 401')
        }
        return
      }
      // If 401 interrupted the initial flush, writeBatch may have silently
      // no-op'd on the closed uploader (ccr.close() ran in the SSE wrapper
      // before our setOnClose callback). Reset so the new onConnect re-flushes.
      // (v1 scopes initialFlushDone inside the per-transport closure at
      // replBridge.ts:1027 so it resets naturally; v2 has it at outer scope.)
      initialFlushDone = false
      await rebuildTransport(fresh, 'auth_401_recovery')
      logForDebugging('[remote-bridge] Transport rebuilt after 401')
    } catch (err) {
      logForDebugging(
        `[remote-bridge] 401 recovery failed: ${errorMessage(err)}`,
        { level: 'error' },
      )
      logForDiagnosticsNoPII('error', 'bridge_repl_v2_jwt_refresh_failed')
      if (!tornDown) {
        onStateChange?.('failed', `JWT refresh failed: ${errorMessage(err)}`)
      }
    } finally {
      authRecoveryInFlight = false
    }
  }

  wireTransportCallbacks()

  // Start flushGate BEFORE connect so writeMessages() during handshake
  // queues instead of racing the history POST.
  if (initialMessages && initialMessages.length > 0) {
    flushGate.start()
  }
  transport.connect()
  connectDeadline = setTimeout(
    onConnectTimeout,
    cfg.connect_timeout_ms,
    connectCause,
  )

  // ── 8. History flush + drain helpers ────────────────────────────────────
  function drainFlushGate(): void {
    const msgs = flushGate.end()
    if (msgs.length === 0) return
    for (const msg of msgs) recentPostedUUIDs.add(msg.uuid)
    const events = toSDKMessages(msgs).map(m => ({
      ...m,
      session_id: sessionId,
    }))
    if (msgs.some(m => m.type === 'user')) {
      transport.reportState('running')
    }
    logForDebugging(
      `[remote-bridge] Drained ${msgs.length} queued message(s) after flush`,
    )
    void transport.writeBatch(events)
  }

  async function flushHistory(msgs: Message[]): Promise<void> {
    // v2 always creates a fresh server session (unconditional createCodeSession
    // above) — no session reuse, no double-post risk. Unlike v1, we do NOT
    // filter by previouslyFlushedUUIDs: that set persists across REPL enable/
    // disable cycles (useRef), so it would wrongly suppress history on re-enable.
    const eligible = msgs.filter(isEligibleBridgeMessage)
    const capped =
      initialHistoryCap > 0 && eligible.length > initialHistoryCap
        ? eligible.slice(-initialHistoryCap)
        : eligible
    if (capped.length < eligible.length) {
      logForDebugging(
        `[remote-bridge] Capped initial flush: ${eligible.length} -> ${capped.length} (cap=${initialHistoryCap})`,
      )
    }
    const events = toSDKMessages(capped).map(m => ({
      ...m,
      session_id: sessionId,
    }))
    if (events.length === 0) return
    // Mid-turn init: if Remote Control is enabled while a query is running,
    // the last eligible message is a user prompt or tool_result (both 'user'
    // type). Without this the init PUT's 'idle' sticks until the next user-
    // type message forwards via writeMessages — which for a pure-text turn
    // is never (only assistant chunks stream post-init). Check eligible (pre-
    // cap), not capped: the cap may truncate to a user message even when the
    // actual trailing message is assistant.
    if (eligible.at(-1)?.type === 'user') {
      transport.reportState('running')
    }
    logForDebugging(`[remote-bridge] Flushing ${events.length} history events`)
    await transport.writeBatch(events)
  }

  // ── 9. Teardown ───────────────────────────────────────────────────────────
  // On SIGINT/SIGTERM/⁠/exit, gracefulShutdown races runCleanupFunctions()
  // against a 2s cap before forceExit kills the process. Budget accordingly:
  //   - archive: teardown_archive_timeout_ms (default 1500, cap 2000)
  //   - result write: fire-and-forget, archive latency covers the drain
  //   - 401 retry: only if first archive 401s, shares the same budget
  async function teardown(): Promise<void> {
    if (tornDown) return
    tornDown = true
    refresh.cancelAll()
    clearTimeout(connectDeadline)
    flushGate.drop()

    // Fire the result message before archive — transport.write() only awaits
    // enqueue (SerialBatchEventUploader resolves once buffered, drain is
    // async). Archiving before close() gives the uploader's drain loop a
    // window (typical archive ≈ 100-500ms) to POST the result without an
    // explicit sleep. close() sets closed=true which interrupts drain at the
    // next while-check, so close-before-archive drops the result.
    transport.reportState('idle')
    void transport.write(makeResultMessage(sessionId))

    let token = getAccessToken()
    let status = await archiveSession(
      sessionId,
      baseUrl,
      token,
      orgUUID,
      cfg.teardown_archive_timeout_ms,
    )

    // Token is usually fresh (refresh scheduler runs 5min before expiry) but
    // laptop-wake past the refresh window leaves getAccessToken() returning a
    // stale string. Retry once on 401 — onAuth401 (= handleOAuth401Error)
    // clears keychain cache + force-refreshes. No proactive refresh on the
    // happy path: handleOAuth401Error force-refreshes even valid tokens,
    // which would waste budget 99% of the time. try/catch mirrors
    // recoverFromAuthFailure: keychain reads can throw (macOS locked after
    // wake); an uncaught throw here would skip transport.close + telemetry.
    if (status === 401 && onAuth401) {
      try {
        await onAuth401(token ?? '')
        token = getAccessToken()
        status = await archiveSession(
          sessionId,
          baseUrl,
          token,
          orgUUID,
          cfg.teardown_archive_timeout_ms,
        )
      } catch (err) {
        logForDebugging(
          `[remote-bridge] Teardown 401 retry threw: ${errorMessage(err)}`,
          { level: 'error' },
        )
      }
    }

    transport.close()

    const archiveStatus: ArchiveTelemetryStatus =
      status === 'no_token'
        ? 'skipped_no_token'
        : status === 'timeout' || status === 'error'
          ? 'network_error'
          : status >= 500
            ? 'server_5xx'
            : status >= 400
              ? 'server_4xx'
              : 'ok'

    logForDebugging(`[remote-bridge] Torn down (archive=${status})`)
    logForDiagnosticsNoPII('info', 'bridge_repl_v2_teardown')
    logEvent(
      feature('CCR_MIRROR') && outboundOnly
        ? 'tengu_ccr_mirror_teardown'
        : 'tengu_bridge_repl_teardown',
      {
        v2: true,
        archive_status:
          archiveStatus as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        archive_ok: typeof status === 'number' && status < 400,
        archive_http_status: typeof status === 'number' ? status : undefined,
        archive_timeout: status === 'timeout',
        archive_no_token: status === 'no_token',
      },
    )
  }
  const unregister = registerCleanup(teardown)

  if (feature('CCR_MIRROR') && outboundOnly) {
    logEvent('tengu_ccr_mirror_started', {
      v2: true,
      expires_in_s: credentials.expires_in,
    })
  } else {
    logEvent('tengu_bridge_repl_started', {
      has_initial_messages: !!(initialMessages && initialMessages.length > 0),
      v2: true,
      expires_in_s: credentials.expires_in,
      inProtectedNamespace: isInProtectedNamespace(),
    })
  }

  // ── 10. Handle ──────────────────────────────────────────────────────────
  return {
    bridgeSessionId: sessionId,
    environmentId: '',
    sessionIngressUrl: credentials.api_base_url,
    writeMessages(messages) {
      const filtered = messages.filter(
        m =>
          isEligibleBridgeMessage(m) &&
          !initialMessageUUIDs.has(m.uuid) &&
          !recentPostedUUIDs.has(m.uuid),
      )
      if (filtered.length === 0) return

      // Fire onUserMessage for title derivation. Scan before the flushGate
      // check — prompts are title-worthy even if they queue. Keeps calling
      // on every title-worthy message until the callback returns true; the
      // caller owns the policy (derive at 1st and 3rd, skip if explicit).
      if (!userMessageCallbackDone) {
        for (const m of filtered) {
          const text = extractTitleText(m)
          if (text !== undefined && onUserMessage?.(text, sessionId)) {
            userMessageCallbackDone = true
            break
          }
        }
      }

      if (flushGate.enqueue(...filtered)) {
        logForDebugging(
          `[remote-bridge] Queued ${filtered.length} message(s) during flush`,
        )
        return
      }

      for (const msg of filtered) recentPostedUUIDs.add(msg.uuid)
      const events = toSDKMessages(filtered).map(m => ({
        ...m,
        session_id: sessionId,
      }))
      // v2 does not derive worker_status from events server-side (unlike v1
      // session-ingress session_status_updater.go). Push it from here so the
      // CCR web session list shows Running instead of stuck on Idle. A user
      // message in the batch marks turn start. CCRClient.reportState dedupes
      // consecutive same-state pushes.
      if (filtered.some(m => m.type === 'user')) {
        transport.reportState('running')
      }
      logForDebugging(`[remote-bridge] Sending ${filtered.length} message(s)`)
      void transport.writeBatch(events)
    },
    writeSdkMessages(messages: SDKMessage[]) {
      const filtered = messages.filter(
        m => !m.uuid || !recentPostedUUIDs.has(m.uuid),
      )
      if (filtered.length === 0) return
      for (const msg of filtered) {
        if (msg.uuid) recentPostedUUIDs.add(msg.uuid)
      }
      const events = filtered.map(m => ({ ...m, session_id: sessionId }))
      void transport.writeBatch(events)
    },
    sendControlRequest(request: SDKControlRequest) {
      if (authRecoveryInFlight) {
        logForDebugging(
          `[remote-bridge] Dropping control_request during 401 recovery: ${request.request_id}`,
        )
        return
      }
      const event = { ...request, session_id: sessionId }
      if (request.request.subtype === 'can_use_tool') {
        transport.reportState('requires_action')
      }
      void transport.write(event)
      logForDebugging(
        `[remote-bridge] Sent control_request request_id=${request.request_id}`,
      )
    },
    sendControlResponse(response: SDKControlResponse) {
      if (authRecoveryInFlight) {
        logForDebugging(
          '[remote-bridge] Dropping control_response during 401 recovery',
        )
        return
      }
      const event = { ...response, session_id: sessionId }
      transport.reportState('running')
      void transport.write(event)
      logForDebugging('[remote-bridge] Sent control_response')
    },
    sendControlCancelRequest(requestId: string) {
      if (authRecoveryInFlight) {
        logForDebugging(
          `[remote-bridge] Dropping control_cancel_request during 401 recovery: ${requestId}`,
        )
        return
      }
      const event = {
        type: 'control_cancel_request' as const,
        request_id: requestId,
        session_id: sessionId,
      }
      // Hook/classifier/channel/recheck resolved the permission locally —
      // interactiveHandler calls only cancelRequest (no sendResponse) on
      // those paths, so without this the server stays on requires_action.
      transport.reportState('running')
      void transport.write(event)
      logForDebugging(
        `[remote-bridge] Sent control_cancel_request request_id=${requestId}`,
      )
    },
    sendResult() {
      if (authRecoveryInFlight) {
        logForDebugging('[remote-bridge] Dropping result during 401 recovery')
        return
      }
      transport.reportState('idle')
      void transport.write(makeResultMessage(sessionId))
      logForDebugging(`[remote-bridge] Sent result`)
    },
    async teardown() {
      unregister()
      await teardown()
    },
  }
}

// ─── Session API (v2 /code/sessions, no env) ─────────────────────────────────

/** Retry an async init call with exponential backoff + jitter. */
async function withRetry<T>(
  fn: () => Promise<T | null>,
  label: string,
  cfg: EnvLessBridgeConfig,
): Promise<T | null> {
  const max = cfg.init_retry_max_attempts
  for (let attempt = 1; attempt <= max; attempt++) {
    const result = await fn()
    if (result !== null) return result
    if (attempt < max) {
      const base = cfg.init_retry_base_delay_ms * 2 ** (attempt - 1)
      const jitter =
        base * cfg.init_retry_jitter_fraction * (2 * Math.random() - 1)
      const delay = Math.min(base + jitter, cfg.init_retry_max_delay_ms)
      logForDebugging(
        `[remote-bridge] ${label} failed (attempt ${attempt}/${max}), retrying in ${Math.round(delay)}ms`,
      )
      await sleep(delay)
    }
  }
  return null
}

// Moved to codeSessionApi.ts so the SDK /bridge subpath can bundle them
// without pulling in this file's heavy CLI tree (analytics, transport).
export {
  createCodeSession,
  type RemoteCredentials,
} from './codeSessionApi.js'
import {
  createCodeSession,
  fetchRemoteCredentials as fetchRemoteCredentialsRaw,
  type RemoteCredentials,
} from './codeSessionApi.js'
import { getBridgeBaseUrlOverride } from './bridgeConfig.js'

// CLI-side wrapper that applies the CLAUDE_BRIDGE_BASE_URL dev override and
// injects the trusted-device token (both are env/GrowthBook reads that the
// SDK-facing codeSessionApi.ts export must stay free of).
export async function fetchRemoteCredentials(
  sessionId: string,
  baseUrl: string,
  accessToken: string,
  timeoutMs: number,
): Promise<RemoteCredentials | null> {
  const creds = await fetchRemoteCredentialsRaw(
    sessionId,
    baseUrl,
    accessToken,
    timeoutMs,
    getTrustedDeviceToken(),
  )
  if (!creds) return null
  return getBridgeBaseUrlOverride()
    ? { ...creds, api_base_url: baseUrl }
    : creds
}

type ArchiveStatus = number | 'timeout' | 'error' | 'no_token'

// Single categorical for BQ `GROUP BY archive_status`. The booleans on
// _teardown predate this and are redundant with it (except archive_timeout,
// which distinguishes ECONNABORTED from other network errors — both map to
// 'network_error' here since the dominant cause in a 1.5s window is timeout).
type ArchiveTelemetryStatus =
  | 'ok'
  | 'skipped_no_token'
  | 'network_error'
  | 'server_4xx'
  | 'server_5xx'

async function archiveSession(
  sessionId: string,
  baseUrl: string,
  accessToken: string | undefined,
  orgUUID: string,
  timeoutMs: number,
): Promise<ArchiveStatus> {
  if (!accessToken) return 'no_token'
  // Archive lives at the compat layer (/v1/sessions/*, not /v1/code/sessions).
  // compat.parseSessionID only accepts TagSession (session_*), so retag cse_*.
  // anthropic-beta + x-organization-uuid are required — without them the
  // compat gateway 404s before reaching the handler.
  //
  // Unlike bridgeMain.ts (which caches compatId in sessionCompatIds to keep
  // in-memory titledSessions/logger keys consistent across a mid-session
  // gate flip), this compatId is only a server URL path segment — no
  // in-memory state. Fresh compute matches whatever the server currently
  // validates: if the gate is OFF, the server has been updated to accept
  // cse_* and we correctly send it.
  const compatId = toCompatSessionId(sessionId)
  try {
    const response = await axios.post(
      `${baseUrl}/v1/sessions/${compatId}/archive`,
      {},
      {
        headers: {
          ...oauthHeaders(accessToken),
          'anthropic-beta': 'ccr-byoc-2025-07-29',
          'x-organization-uuid': orgUUID,
        },
        timeout: timeoutMs,
        validateStatus: () => true,
      },
    )
    logForDebugging(
      `[remote-bridge] Archive ${compatId} status=${response.status}`,
    )
    return response.status
  } catch (err) {
    const msg = errorMessage(err)
    logForDebugging(`[remote-bridge] Archive failed: ${msg}`)
    return axios.isAxiosError(err) && err.code === 'ECONNABORTED'
      ? 'timeout'
      : 'error'
  }
}
