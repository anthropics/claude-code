import type { StdoutMessage } from 'src/entrypoints/sdk/controlTypes.js'
import { CCRClient } from '../cli/transports/ccrClient.js'
import type { HybridTransport } from '../cli/transports/HybridTransport.js'
import { SSETransport } from '../cli/transports/SSETransport.js'
import { logForDebugging } from '../utils/debug.js'
import { errorMessage } from '../utils/errors.js'
import { updateSessionIngressAuthToken } from '../utils/sessionIngressAuth.js'
import type { SessionState } from '../utils/sessionState.js'
import { registerWorker } from './workSecret.js'

/**
 * Transport abstraction for replBridge. Covers exactly the surface that
 * replBridge.ts uses against HybridTransport so the v1/v2 choice is
 * confined to the construction site.
 *
 * - v1: HybridTransport (WS reads + POST writes to Session-Ingress)
 * - v2: SSETransport (reads) + CCRClient (writes to CCR v2 /worker/*)
 *
 * The v2 write path goes through CCRClient.writeEvent → SerialBatchEventUploader,
 * NOT through SSETransport.write() — SSETransport.write() targets the
 * Session-Ingress POST URL shape, which is wrong for CCR v2.
 */
export type ReplBridgeTransport = {
  write(message: StdoutMessage): Promise<void>
  writeBatch(messages: StdoutMessage[]): Promise<void>
  close(): void
  isConnectedStatus(): boolean
  getStateLabel(): string
  setOnData(callback: (data: string) => void): void
  setOnClose(callback: (closeCode?: number) => void): void
  setOnConnect(callback: () => void): void
  connect(): void
  /**
   * High-water mark of the underlying read stream's event sequence numbers.
   * replBridge reads this before swapping transports so the new one can
   * resume from where the old one left off (otherwise the server replays
   * the entire session history from seq 0).
   *
   * v1 returns 0 — Session-Ingress WS doesn't use SSE sequence numbers;
   * replay-on-reconnect is handled by the server-side message cursor.
   */
  getLastSequenceNum(): number
  /**
   * Monotonic count of batches dropped via maxConsecutiveFailures.
   * Snapshot before writeBatch() and compare after to detect silent drops
   * (writeBatch() resolves normally even when batches were dropped).
   * v2 returns 0 — the v2 write path doesn't set maxConsecutiveFailures.
   */
  readonly droppedBatchCount: number
  /**
   * PUT /worker state (v2 only; v1 is a no-op). `requires_action` tells
   * the backend a permission prompt is pending — claude.ai shows the
   * "waiting for input" indicator. REPL/daemon callers don't need this
   * (user watches the REPL locally); multi-session worker callers do.
   */
  reportState(state: SessionState): void
  /** PUT /worker external_metadata (v2 only; v1 is a no-op). */
  reportMetadata(metadata: Record<string, unknown>): void
  /**
   * POST /worker/events/{id}/delivery (v2 only; v1 is a no-op). Populates
   * CCR's processing_at/processed_at columns. `received` is auto-fired by
   * CCRClient on every SSE frame and is not exposed here.
   */
  reportDelivery(eventId: string, status: 'processing' | 'processed'): void
  /**
   * Drain the write queue before close() (v2 only; v1 resolves
   * immediately — HybridTransport POSTs are already awaited per-write).
   */
  flush(): Promise<void>
}

/**
 * v1 adapter: HybridTransport already has the full surface (it extends
 * WebSocketTransport which has setOnConnect + getStateLabel). This is a
 * no-op wrapper that exists only so replBridge's `transport` variable
 * has a single type.
 */
export function createV1ReplTransport(
  hybrid: HybridTransport,
): ReplBridgeTransport {
  return {
    write: msg => hybrid.write(msg),
    writeBatch: msgs => hybrid.writeBatch(msgs),
    close: () => hybrid.close(),
    isConnectedStatus: () => hybrid.isConnectedStatus(),
    getStateLabel: () => hybrid.getStateLabel(),
    setOnData: cb => hybrid.setOnData(cb),
    setOnClose: cb => hybrid.setOnClose(cb),
    setOnConnect: cb => hybrid.setOnConnect(cb),
    connect: () => void hybrid.connect(),
    // v1 Session-Ingress WS doesn't use SSE sequence numbers; replay
    // semantics are different. Always return 0 so the seq-num carryover
    // logic in replBridge is a no-op for v1.
    getLastSequenceNum: () => 0,
    get droppedBatchCount() {
      return hybrid.droppedBatchCount
    },
    reportState: () => {},
    reportMetadata: () => {},
    reportDelivery: () => {},
    flush: () => Promise.resolve(),
  }
}

/**
 * v2 adapter: wrap SSETransport (reads) + CCRClient (writes, heartbeat,
 * state, delivery tracking).
 *
 * Auth: v2 endpoints validate the JWT's session_id claim (register_worker.go:32)
 * and worker role (environment_auth.py:856). OAuth tokens have neither.
 * This is the inverse of the v1 replBridge path, which deliberately uses OAuth.
 * The JWT is refreshed when the poll loop re-dispatches work — the caller
 * invokes createV2ReplTransport again with the fresh token.
 *
 * Registration happens here (not in the caller) so the entire v2 handshake
 * is one async step. registerWorker failure propagates — replBridge will
 * catch it and stay on the poll loop.
 */
export async function createV2ReplTransport(opts: {
  sessionUrl: string
  ingressToken: string
  sessionId: string
  /**
   * SSE sequence-number high-water mark from the previous transport.
   * Passed to the new SSETransport so its first connect() sends
   * from_sequence_num / Last-Event-ID and the server resumes from where
   * the old stream left off. Without this, every transport swap asks the
   * server to replay the entire session history from seq 0.
   */
  initialSequenceNum?: number
  /**
   * Worker epoch from POST /bridge response. When provided, the server
   * already bumped epoch (the /bridge call IS the register — see server
   * PR #293280). When omitted (v1 CCR-v2 path via replBridge.ts poll loop),
   * call registerWorker as before.
   */
  epoch?: number
  /** CCRClient heartbeat interval. Defaults to 20s when omitted. */
  heartbeatIntervalMs?: number
  /** ±fraction per-beat jitter. Defaults to 0 (no jitter) when omitted. */
  heartbeatJitterFraction?: number
  /**
   * When true, skip opening the SSE read stream — only the CCRClient write
   * path is activated. Use for mirror-mode attachments that forward events
   * but never receive inbound prompts or control requests.
   */
  outboundOnly?: boolean
  /**
   * Per-instance auth header source. When provided, CCRClient + SSETransport
   * read auth from this closure instead of the process-wide
   * CLAUDE_CODE_SESSION_ACCESS_TOKEN env var. Required for callers managing
   * multiple concurrent sessions — the env-var path stomps across sessions.
   * When omitted, falls back to the env var (single-session callers).
   */
  getAuthToken?: () => string | undefined
}): Promise<ReplBridgeTransport> {
  const {
    sessionUrl,
    ingressToken,
    sessionId,
    initialSequenceNum,
    getAuthToken,
  } = opts

  // Auth header builder. If getAuthToken is provided, read from it
  // (per-instance, multi-session safe). Otherwise write ingressToken to
  // the process-wide env var (legacy single-session path — CCRClient's
  // default getAuthHeaders reads it via getSessionIngressAuthHeaders).
  let getAuthHeaders: (() => Record<string, string>) | undefined
  if (getAuthToken) {
    getAuthHeaders = (): Record<string, string> => {
      const token = getAuthToken()
      if (!token) return {}
      return { Authorization: `Bearer ${token}` }
    }
  } else {
    // CCRClient.request() and SSETransport.connect() both read auth via
    // getSessionIngressAuthHeaders() → this env var. Set it before either
    // touches the network.
    updateSessionIngressAuthToken(ingressToken)
  }

  const epoch = opts.epoch ?? (await registerWorker(sessionUrl, ingressToken))
  logForDebugging(
    `[bridge:repl] CCR v2: worker sessionId=${sessionId} epoch=${epoch}${opts.epoch !== undefined ? ' (from /bridge)' : ' (via registerWorker)'}`,
  )

  // Derive SSE stream URL. Same logic as transportUtils.ts:26-33 but
  // starting from an http(s) base instead of a --sdk-url that might be ws://.
  const sseUrl = new URL(sessionUrl)
  sseUrl.pathname = sseUrl.pathname.replace(/\/$/, '') + '/worker/events/stream'

  const sse = new SSETransport(
    sseUrl,
    {},
    sessionId,
    undefined,
    initialSequenceNum,
    getAuthHeaders,
  )
  let onCloseCb: ((closeCode?: number) => void) | undefined
  const ccr = new CCRClient(sse, new URL(sessionUrl), {
    getAuthHeaders,
    heartbeatIntervalMs: opts.heartbeatIntervalMs,
    heartbeatJitterFraction: opts.heartbeatJitterFraction,
    // Default is process.exit(1) — correct for spawn-mode children. In-process,
    // that kills the REPL. Close instead: replBridge's onClose wakes the poll
    // loop, which picks up the server's re-dispatch (with fresh epoch).
    onEpochMismatch: () => {
      logForDebugging(
        '[bridge:repl] CCR v2: epoch superseded (409) — closing for poll-loop recovery',
      )
      // Close resources in a try block so the throw always executes.
      // If ccr.close() or sse.close() throw, we still need to unwind
      // the caller (request()) — otherwise handleEpochMismatch's `never`
      // return type is violated at runtime and control falls through.
      try {
        ccr.close()
        sse.close()
        onCloseCb?.(4090)
      } catch (closeErr: unknown) {
        logForDebugging(
          `[bridge:repl] CCR v2: error during epoch-mismatch cleanup: ${errorMessage(closeErr)}`,
          { level: 'error' },
        )
      }
      // Don't return — the calling request() code continues after the 409
      // branch, so callers see the logged warning and a false return. We
      // throw to unwind; the uploaders catch it as a send failure.
      throw new Error('epoch superseded')
    },
  })

  // CCRClient's constructor wired sse.setOnEvent → reportDelivery('received').
  // remoteIO.ts additionally sends 'processing'/'processed' via
  // setCommandLifecycleListener, which the in-process query loop fires. This
  // transport's only caller (replBridge/daemonBridge) has no such wiring — the
  // daemon's agent child is a separate process (ProcessTransport), and its
  // notifyCommandLifecycle calls fire with listener=null in its own module
  // scope. So events stay at 'received' forever, and reconnectSession re-queues
  // them on every daemon restart (observed: 21→24→25 phantom prompts as
  // "user sent a new message while you were working" system-reminders).
  //
  // Fix: ACK 'processed' immediately alongside 'received'. The window between
  // SSE receipt and transcript-write is narrow (queue → SDK → child stdin →
  // model); a crash there loses one prompt vs. the observed N-prompt flood on
  // every restart. Overwrite the constructor's wiring to do both — setOnEvent
  // replaces, not appends (SSETransport.ts:658).
  sse.setOnEvent(event => {
    ccr.reportDelivery(event.event_id, 'received')
    ccr.reportDelivery(event.event_id, 'processed')
  })

  // Both sse.connect() and ccr.initialize() are deferred to connect() below.
  // replBridge's calling order is newTransport → setOnConnect → setOnData →
  // setOnClose → connect(), and both calls need those callbacks wired first:
  // sse.connect() opens the stream (events flow to onData/onClose immediately),
  // and ccr.initialize().then() fires onConnectCb.
  //
  // onConnect fires once ccr.initialize() resolves. Writes go via
  // CCRClient HTTP POST (SerialBatchEventUploader), not SSE, so the
  // write path is ready the moment workerEpoch is set. SSE.connect()
  // awaits its read loop and never resolves — don't gate on it.
  // The SSE stream opens in parallel (~30ms) and starts delivering
  // inbound events via setOnData; outbound doesn't need to wait for it.
  let onConnectCb: (() => void) | undefined
  let ccrInitialized = false
  let closed = false

  return {
    write(msg) {
      return ccr.writeEvent(msg)
    },
    async writeBatch(msgs) {
      // SerialBatchEventUploader already batches internally (maxBatchSize=100);
      // sequential enqueue preserves order and the uploader coalesces.
      // Check closed between writes to avoid sending partial batches after
      // transport teardown (epoch mismatch, SSE drop).
      for (const m of msgs) {
        if (closed) break
        await ccr.writeEvent(m)
      }
    },
    close() {
      closed = true
      ccr.close()
      sse.close()
    },
    isConnectedStatus() {
      // Write-readiness, not read-readiness — replBridge checks this
      // before calling writeBatch. SSE open state is orthogonal.
      return ccrInitialized
    },
    getStateLabel() {
      // SSETransport doesn't expose its state string; synthesize from
      // what we can observe. replBridge only uses this for debug logging.
      if (sse.isClosedStatus()) return 'closed'
      if (sse.isConnectedStatus()) return ccrInitialized ? 'connected' : 'init'
      return 'connecting'
    },
    setOnData(cb) {
      sse.setOnData(cb)
    },
    setOnClose(cb) {
      onCloseCb = cb
      // SSE reconnect-budget exhaustion fires onClose(undefined) — map to
      // 4092 so ws_closed telemetry can distinguish it from HTTP-status
      // closes (SSETransport:280 passes response.status). Stop CCRClient's
      // heartbeat timer before notifying replBridge. (sse.close() doesn't
      // invoke this, so the epoch-mismatch path above isn't double-firing.)
      sse.setOnClose(code => {
        ccr.close()
        cb(code ?? 4092)
      })
    },
    setOnConnect(cb) {
      onConnectCb = cb
    },
    getLastSequenceNum() {
      return sse.getLastSequenceNum()
    },
    // v2 write path (CCRClient) doesn't set maxConsecutiveFailures — no drops.
    droppedBatchCount: 0,
    reportState(state) {
      ccr.reportState(state)
    },
    reportMetadata(metadata) {
      ccr.reportMetadata(metadata)
    },
    reportDelivery(eventId, status) {
      ccr.reportDelivery(eventId, status)
    },
    flush() {
      return ccr.flush()
    },
    connect() {
      // Outbound-only: skip the SSE read stream entirely — no inbound
      // events to receive, no delivery ACKs to send. Only the CCRClient
      // write path (POST /worker/events) and heartbeat are needed.
      if (!opts.outboundOnly) {
        // Fire-and-forget — SSETransport.connect() awaits readStream()
        // (the read loop) and only resolves on stream close/error. The
        // spawn-mode path in remoteIO.ts does the same void discard.
        void sse.connect()
      }
      void ccr.initialize(epoch).then(
        () => {
          ccrInitialized = true
          logForDebugging(
            `[bridge:repl] v2 transport ready for writes (epoch=${epoch}, sse=${sse.isConnectedStatus() ? 'open' : 'opening'})`,
          )
          onConnectCb?.()
        },
        (err: unknown) => {
          logForDebugging(
            `[bridge:repl] CCR v2 initialize failed: ${errorMessage(err)}`,
            { level: 'error' },
          )
          // Close transport resources and notify replBridge via onClose
          // so the poll loop can retry on the next work dispatch.
          // Without this callback, replBridge never learns the transport
          // failed to initialize and sits with transport === null forever.
          ccr.close()
          sse.close()
          onCloseCb?.(4091) // 4091 = init failure, distinguishable from 4090 epoch mismatch
        },
      )
    },
  }
}
