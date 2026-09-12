import type { StdoutMessage } from 'src/entrypoints/sdk/controlTypes.js'
import { PassThrough } from 'stream'
import { URL } from 'url'
import { getSessionId } from '../bootstrap/state.js'
import { getPollIntervalConfig } from '../bridge/pollConfig.js'
import { registerCleanup } from '../utils/cleanupRegistry.js'
import { setCommandLifecycleListener } from '../utils/commandLifecycle.js'
import { isDebugMode, logForDebugging } from '../utils/debug.js'
import { logForDiagnosticsNoPII } from '../utils/diagLogs.js'
import { isEnvTruthy } from '../utils/envUtils.js'
import { errorMessage } from '../utils/errors.js'
import { gracefulShutdown } from '../utils/gracefulShutdown.js'
import { logError } from '../utils/log.js'
import { writeToStdout } from '../utils/process.js'
import { getSessionIngressAuthToken } from '../utils/sessionIngressAuth.js'
import {
  setSessionMetadataChangedListener,
  setSessionStateChangedListener,
} from '../utils/sessionState.js'
import {
  setInternalEventReader,
  setInternalEventWriter,
} from '../utils/sessionStorage.js'
import { ndjsonSafeStringify } from './ndjsonSafeStringify.js'
import { StructuredIO } from './structuredIO.js'
import { CCRClient, CCRInitError } from './transports/ccrClient.js'
import { SSETransport } from './transports/SSETransport.js'
import type { Transport } from './transports/Transport.js'
import { getTransportForUrl } from './transports/transportUtils.js'

/**
 * Bidirectional streaming for SDK mode with session tracking
 * Supports WebSocket transport
 */
export class RemoteIO extends StructuredIO {
  private url: URL
  private transport: Transport
  private inputStream: PassThrough
  private readonly isBridge: boolean = false
  private readonly isDebug: boolean = false
  private ccrClient: CCRClient | null = null
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null

  constructor(
    streamUrl: string,
    initialPrompt?: AsyncIterable<string>,
    replayUserMessages?: boolean,
  ) {
    const inputStream = new PassThrough({ encoding: 'utf8' })
    super(inputStream, replayUserMessages)
    this.inputStream = inputStream
    this.url = new URL(streamUrl)

    // Prepare headers with session token if available
    const headers: Record<string, string> = {}
    const sessionToken = getSessionIngressAuthToken()
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`
    } else {
      logForDebugging('[remote-io] No session ingress token available', {
        level: 'error',
      })
    }

    // Add environment runner version if available (set by Environment Manager)
    const erVersion = process.env.CLAUDE_CODE_ENVIRONMENT_RUNNER_VERSION
    if (erVersion) {
      headers['x-environment-runner-version'] = erVersion
    }

    // Provide a callback that re-reads the session token dynamically.
    // When the parent process refreshes the token (via token file or env var),
    // the transport can pick it up on reconnection.
    const refreshHeaders = (): Record<string, string> => {
      const h: Record<string, string> = {}
      const freshToken = getSessionIngressAuthToken()
      if (freshToken) {
        h['Authorization'] = `Bearer ${freshToken}`
      }
      const freshErVersion = process.env.CLAUDE_CODE_ENVIRONMENT_RUNNER_VERSION
      if (freshErVersion) {
        h['x-environment-runner-version'] = freshErVersion
      }
      return h
    }

    // Get appropriate transport based on URL protocol
    this.transport = getTransportForUrl(
      this.url,
      headers,
      getSessionId(),
      refreshHeaders,
    )

    // Set up data callback
    this.isBridge = process.env.CLAUDE_CODE_ENVIRONMENT_KIND === 'bridge'
    this.isDebug = isDebugMode()
    this.transport.setOnData((data: string) => {
      this.inputStream.write(data)
      if (this.isBridge && this.isDebug) {
        writeToStdout(data.endsWith('\n') ? data : data + '\n')
      }
    })

    // Set up close callback to handle connection failures
    this.transport.setOnClose(() => {
      // End the input stream to trigger graceful shutdown
      this.inputStream.end()
    })

    // Initialize CCR v2 client (heartbeats, epoch, state reporting, event writes).
    // The CCRClient constructor wires the SSE received-ack handler
    // synchronously, so new CCRClient() MUST run before transport.connect() —
    // otherwise early SSE frames hit an unwired onEventCallback and their
    // 'received' delivery acks are silently dropped.
    if (isEnvTruthy(process.env.CLAUDE_CODE_USE_CCR_V2)) {
      // CCR v2 is SSE+POST by definition. getTransportForUrl returns
      // SSETransport under the same env var, but the two checks live in
      // different files — assert the invariant so a future decoupling
      // fails loudly here instead of confusingly inside CCRClient.
      if (!(this.transport instanceof SSETransport)) {
        throw new Error(
          'CCR v2 requires SSETransport; check getTransportForUrl',
        )
      }
      this.ccrClient = new CCRClient(this.transport, this.url)
      const init = this.ccrClient.initialize()
      this.restoredWorkerState = init.catch(() => null)
      init.catch((error: unknown) => {
        logForDiagnosticsNoPII('error', 'cli_worker_lifecycle_init_failed', {
          reason: error instanceof CCRInitError ? error.reason : 'unknown',
        })
        logError(
          new Error(`CCRClient initialization failed: ${errorMessage(error)}`),
        )
        void gracefulShutdown(1, 'other')
      })
      registerCleanup(async () => this.ccrClient?.close())

      // Register internal event writer for transcript persistence.
      // When set, sessionStorage writes transcript messages as CCR v2
      // internal events instead of v1 Session Ingress.
      setInternalEventWriter((eventType, payload, options) =>
        this.ccrClient!.writeInternalEvent(eventType, payload, options),
      )

      // Register internal event readers for session resume.
      // When set, hydrateFromCCRv2InternalEvents() can fetch foreground
      // and subagent internal events to reconstruct conversation state.
      setInternalEventReader(
        () => this.ccrClient!.readInternalEvents(),
        () => this.ccrClient!.readSubagentInternalEvents(),
      )

      const LIFECYCLE_TO_DELIVERY = {
        started: 'processing',
        completed: 'processed',
      } as const
      setCommandLifecycleListener((uuid, state) => {
        this.ccrClient?.reportDelivery(uuid, LIFECYCLE_TO_DELIVERY[state])
      })
      setSessionStateChangedListener((state, details) => {
        this.ccrClient?.reportState(state, details)
      })
      setSessionMetadataChangedListener(metadata => {
        this.ccrClient?.reportMetadata(metadata)
      })
    }

    // Start connection only after all callbacks are wired (setOnData above,
    // setOnEvent inside new CCRClient() when CCR v2 is enabled).
    void this.transport.connect()

    // Push a silent keep_alive frame on a fixed interval so upstream
    // proxies and the session-ingress layer don't GC an otherwise-idle
    // remote control session. The keep_alive type is filtered before
    // reaching any client UI (Query.ts drops it; structuredIO.ts drops it;
    // web/iOS/Android never see it in their message loop). Interval comes
    // from GrowthBook (tengu_bridge_poll_interval_config
    // session_keepalive_interval_v2_ms, default 120s); 0 = disabled.
    // Bridge-only: fixes Envoy idle timeout on bridge-topology sessions
    // (#21931). byoc workers ran without this before #21931 and do not
    // need it — different network path.
    const keepAliveIntervalMs =
      getPollIntervalConfig().session_keepalive_interval_v2_ms
    if (this.isBridge && keepAliveIntervalMs > 0) {
      this.keepAliveTimer = setInterval(() => {
        logForDebugging('[remote-io] keep_alive sent')
        void this.write({ type: 'keep_alive' }).catch(err => {
          logForDebugging(
            `[remote-io] keep_alive write failed: ${errorMessage(err)}`,
          )
        })
      }, keepAliveIntervalMs)
      this.keepAliveTimer.unref?.()
    }

    // Register for graceful shutdown cleanup
    registerCleanup(async () => this.close())

    // If initial prompt is provided, send it through the input stream
    if (initialPrompt) {
      // Convert the initial prompt to the input stream format.
      // Chunks from stdin may already contain trailing newlines, so strip
      // them before appending our own to avoid double-newline issues that
      // cause structuredIO to parse empty lines. String() handles both
      // string chunks and Buffer objects from process.stdin.
      const stream = this.inputStream
      void (async () => {
        for await (const chunk of initialPrompt) {
          stream.write(String(chunk).replace(/\n$/, '') + '\n')
        }
      })()
    }
  }

  override flushInternalEvents(): Promise<void> {
    return this.ccrClient?.flushInternalEvents() ?? Promise.resolve()
  }

  override get internalEventsPending(): number {
    return this.ccrClient?.internalEventsPending ?? 0
  }

  /**
   * Send output to the transport.
   * In bridge mode, control_request messages are always echoed to stdout so the
   * bridge parent can detect permission requests. Other messages are echoed only
   * in debug mode.
   */
  async write(message: StdoutMessage): Promise<void> {
    if (this.ccrClient) {
      await this.ccrClient.writeEvent(message)
    } else {
      await this.transport.write(message)
    }
    if (this.isBridge) {
      if (message.type === 'control_request' || this.isDebug) {
        writeToStdout(ndjsonSafeStringify(message) + '\n')
      }
    }
  }

  /**
   * Clean up connections gracefully
   */
  close(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer)
      this.keepAliveTimer = null
    }
    this.transport.close()
    this.inputStream.end()
  }
}
