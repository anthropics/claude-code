/** Default per-session timeout (24 hours). */
export const DEFAULT_SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000

/** Reusable login guidance appended to bridge auth errors. */
export const BRIDGE_LOGIN_INSTRUCTION =
  'Remote Control is only available with claude.ai subscriptions. Please use `/login` to sign in with your claude.ai account.'

/** Full error printed when `claude remote-control` is run without auth. */
export const BRIDGE_LOGIN_ERROR =
  'Error: You must be logged in to use Remote Control.\n\n' +
  BRIDGE_LOGIN_INSTRUCTION

/** Shown when the user disconnects Remote Control (via /remote-control or ultraplan launch). */
export const REMOTE_CONTROL_DISCONNECTED_MSG = 'Remote Control disconnected.'

// --- Protocol types for the environments API ---

export type WorkData = {
  type: 'session' | 'healthcheck'
  id: string
}

export type WorkResponse = {
  id: string
  type: 'work'
  environment_id: string
  state: string
  data: WorkData
  secret: string // base64url-encoded JSON
  created_at: string
}

export type WorkSecret = {
  version: number
  session_ingress_token: string
  api_base_url: string
  sources: Array<{
    type: string
    git_info?: { type: string; repo: string; ref?: string; token?: string }
  }>
  auth: Array<{ type: string; token: string }>
  claude_code_args?: Record<string, string> | null
  mcp_config?: unknown | null
  environment_variables?: Record<string, string> | null
  /**
   * Server-driven CCR v2 selector. Set by prepare_work_secret() when the
   * session was created via the v2 compat layer (ccr_v2_compat_enabled).
   * Same field the BYOC runner reads at environment-runner/sessionExecutor.ts.
   */
  use_code_sessions?: boolean
}

export type SessionDoneStatus = 'completed' | 'failed' | 'interrupted'

export type SessionActivityType = 'tool_start' | 'text' | 'result' | 'error'

export type SessionActivity = {
  type: SessionActivityType
  summary: string // e.g. "Editing src/foo.ts", "Reading package.json"
  timestamp: number
}

/**
 * How `claude remote-control` chooses session working directories.
 * - `single-session`: one session in cwd, bridge tears down when it ends
 * - `worktree`: persistent server, every session gets an isolated git worktree
 * - `same-dir`: persistent server, every session shares cwd (can stomp each other)
 */
export type SpawnMode = 'single-session' | 'worktree' | 'same-dir'

/**
 * Well-known worker_type values THIS codebase produces. Sent as
 * `metadata.worker_type` at environment registration so claude.ai can filter
 * the session picker by origin (e.g. assistant tab only shows assistant
 * workers). The backend treats this as an opaque string — desktop cowork
 * sends `"cowork"`, which isn't in this union. REPL code uses this narrow
 * type for its own exhaustiveness; wire-level fields accept any string.
 */
export type BridgeWorkerType = 'claude_code' | 'claude_code_assistant'

export type BridgeConfig = {
  dir: string
  machineName: string
  branch: string
  gitRepoUrl: string | null
  maxSessions: number
  spawnMode: SpawnMode
  verbose: boolean
  sandbox: boolean
  /** Client-generated UUID identifying this bridge instance. */
  bridgeId: string
  /**
   * Sent as metadata.worker_type so web clients can filter by origin.
   * Backend treats this as opaque — any string, not just BridgeWorkerType.
   */
  workerType: string
  /** Client-generated UUID for idempotent environment registration. */
  environmentId: string
  /**
   * Backend-issued environment_id to reuse on re-register. When set, the
   * backend treats registration as a reconnect to the existing environment
   * instead of creating a new one. Used by `claude remote-control
   * --session-id` resume. Must be a backend-format ID — client UUIDs are
   * rejected with 400.
   */
  reuseEnvironmentId?: string
  /** API base URL the bridge is connected to (used for polling). */
  apiBaseUrl: string
  /** Session ingress base URL for WebSocket connections (may differ from apiBaseUrl locally). */
  sessionIngressUrl: string
  /** Debug file path passed via --debug-file. */
  debugFile?: string
  /** Per-session timeout in milliseconds. Sessions exceeding this are killed. */
  sessionTimeoutMs?: number
}

// --- Dependency interfaces (for testability) ---

/**
 * A control_response event sent back to a session (e.g. a permission decision).
 * The `subtype` is `'success'` per the SDK protocol; the inner `response`
 * carries the permission decision payload (e.g. `{ behavior: 'allow' }`).
 */
export type PermissionResponseEvent = {
  type: 'control_response'
  response: {
    subtype: 'success'
    request_id: string
    response: Record<string, unknown>
  }
}

export type BridgeApiClient = {
  registerBridgeEnvironment(config: BridgeConfig): Promise<{
    environment_id: string
    environment_secret: string
  }>
  pollForWork(
    environmentId: string,
    environmentSecret: string,
    signal?: AbortSignal,
    reclaimOlderThanMs?: number,
  ): Promise<WorkResponse | null>
  acknowledgeWork(
    environmentId: string,
    workId: string,
    sessionToken: string,
  ): Promise<void>
  /** Stop a work item via the environments API. */
  stopWork(environmentId: string, workId: string, force: boolean): Promise<void>
  /** Deregister/delete the bridge environment on graceful shutdown. */
  deregisterEnvironment(environmentId: string): Promise<void>
  /** Send a permission response (control_response) to a session via the session events API. */
  sendPermissionResponseEvent(
    sessionId: string,
    event: PermissionResponseEvent,
    sessionToken: string,
  ): Promise<void>
  /** Archive a session so it no longer appears as active on the server. */
  archiveSession(sessionId: string): Promise<void>
  /**
   * Force-stop stale worker instances and re-queue a session on an environment.
   * Used by `--session-id` to resume a session after the original bridge died.
   */
  reconnectSession(environmentId: string, sessionId: string): Promise<void>
  /**
   * Send a lightweight heartbeat for an active work item, extending its lease.
   * Uses SessionIngressAuth (JWT, no DB hit) instead of EnvironmentSecretAuth.
   * Returns the server's response with lease status.
   */
  heartbeatWork(
    environmentId: string,
    workId: string,
    sessionToken: string,
  ): Promise<{ lease_extended: boolean; state: string }>
}

export type SessionHandle = {
  sessionId: string
  done: Promise<SessionDoneStatus>
  kill(): void
  forceKill(): void
  activities: SessionActivity[] // ring buffer of recent activities (last ~10)
  currentActivity: SessionActivity | null // most recent
  accessToken: string // session_ingress_token for API calls
  lastStderr: string[] // ring buffer of last stderr lines
  writeStdin(data: string): void // write directly to child stdin
  /** Update the access token for a running session (e.g. after token refresh). */
  updateAccessToken(token: string): void
}

export type SessionSpawnOpts = {
  sessionId: string
  sdkUrl: string
  accessToken: string
  /** When true, spawn the child with CCR v2 env vars (SSE transport + CCRClient). */
  useCcrV2?: boolean
  /** Required when useCcrV2 is true. Obtained from POST /worker/register. */
  workerEpoch?: number
  /**
   * Fires once with the text of the first real user message seen on the
   * child's stdout (via --replay-user-messages). Lets the caller derive a
   * session title when none exists yet. Tool-result and synthetic user
   * messages are skipped.
   */
  onFirstUserMessage?: (text: string) => void
}

export type SessionSpawner = {
  spawn(opts: SessionSpawnOpts, dir: string): SessionHandle
}

export type BridgeLogger = {
  printBanner(config: BridgeConfig, environmentId: string): void
  logSessionStart(sessionId: string, prompt: string): void
  logSessionComplete(sessionId: string, durationMs: number): void
  logSessionFailed(sessionId: string, error: string): void
  logStatus(message: string): void
  logVerbose(message: string): void
  logError(message: string): void
  /** Log a reconnection success event after recovering from connection errors. */
  logReconnected(disconnectedMs: number): void
  /** Show idle status with repo/branch info and shimmer animation. */
  updateIdleStatus(): void
  /** Show reconnecting status in the live display. */
  updateReconnectingStatus(delayStr: string, elapsedStr: string): void
  updateSessionStatus(
    sessionId: string,
    elapsed: string,
    activity: SessionActivity,
    trail: string[],
  ): void
  clearStatus(): void
  /** Set repository info for status line display. */
  setRepoInfo(repoName: string, branch: string): void
  /** Set debug log glob shown above the status line (ant users). */
  setDebugLogPath(path: string): void
  /** Transition to "Attached" state when a session starts. */
  setAttached(sessionId: string): void
  /** Show failed status in the live display. */
  updateFailedStatus(error: string): void
  /** Toggle QR code visibility. */
  toggleQr(): void
  /** Update the "<n> of <m> sessions" indicator and spawn mode hint. */
  updateSessionCount(active: number, max: number, mode: SpawnMode): void
  /** Update the spawn mode shown in the session-count line. Pass null to hide (single-session or toggle unavailable). */
  setSpawnModeDisplay(mode: 'same-dir' | 'worktree' | null): void
  /** Register a new session for multi-session display (called after spawn succeeds). */
  addSession(sessionId: string, url: string): void
  /** Update the per-session activity summary (tool being run) in the multi-session list. */
  updateSessionActivity(sessionId: string, activity: SessionActivity): void
  /**
   * Set a session's display title. In multi-session mode, updates the bullet list
   * entry. In single-session mode, also shows the title in the main status line.
   * Triggers a render (guarded against reconnecting/failed states).
   */
  setSessionTitle(sessionId: string, title: string): void
  /** Remove a session from the multi-session display when it ends. */
  removeSession(sessionId: string): void
  /** Force a re-render of the status display (for multi-session activity refresh). */
  refreshDisplay(): void
}
