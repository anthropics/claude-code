/**
 * Bridge poll interval defaults. Extracted from pollConfig.ts so callers
 * that don't need live GrowthBook tuning (daemon via Agent SDK) can avoid
 * the growthbook.ts → config.ts → file.ts → sessionStorage.ts → commands.ts
 * transitive dependency chain.
 */

/**
 * Poll interval when actively seeking work (no transport / below maxSessions).
 * Governs user-visible "connecting…" latency on initial work pickup and
 * recovery speed after the server re-dispatches a work item.
 */
const POLL_INTERVAL_MS_NOT_AT_CAPACITY = 2000

/**
 * Poll interval when the transport is connected. Runs independently of
 * heartbeat — when both are enabled, the heartbeat loop breaks out to poll
 * at this interval. Set to 0 to disable at-capacity polling entirely.
 *
 * Server-side constraints that bound this value:
 * - BRIDGE_LAST_POLL_TTL = 4h (Redis key expiry → environment auto-archived)
 * - max_poll_stale_seconds = 24h (session-creation health gate, currently disabled)
 *
 * 10 minutes gives 24× headroom on the Redis TTL while still picking up
 * server-initiated token-rotation redispatches within one poll cycle.
 * The transport auto-reconnects internally for 10 minutes on transient WS
 * failures, so poll is not the recovery path — it's strictly a liveness
 * signal plus a backstop for permanent close.
 */
const POLL_INTERVAL_MS_AT_CAPACITY = 600_000

/**
 * Multisession bridge (bridgeMain.ts) poll intervals. Defaults match the
 * single-session values so existing GrowthBook configs without these fields
 * preserve current behavior. Ops can tune these independently via the
 * tengu_bridge_poll_interval_config GB flag.
 */
const MULTISESSION_POLL_INTERVAL_MS_NOT_AT_CAPACITY =
  POLL_INTERVAL_MS_NOT_AT_CAPACITY
const MULTISESSION_POLL_INTERVAL_MS_PARTIAL_CAPACITY =
  POLL_INTERVAL_MS_NOT_AT_CAPACITY
const MULTISESSION_POLL_INTERVAL_MS_AT_CAPACITY = POLL_INTERVAL_MS_AT_CAPACITY

export type PollIntervalConfig = {
  poll_interval_ms_not_at_capacity: number
  poll_interval_ms_at_capacity: number
  non_exclusive_heartbeat_interval_ms: number
  multisession_poll_interval_ms_not_at_capacity: number
  multisession_poll_interval_ms_partial_capacity: number
  multisession_poll_interval_ms_at_capacity: number
  reclaim_older_than_ms: number
  session_keepalive_interval_v2_ms: number
}

export const DEFAULT_POLL_CONFIG: PollIntervalConfig = {
  poll_interval_ms_not_at_capacity: POLL_INTERVAL_MS_NOT_AT_CAPACITY,
  poll_interval_ms_at_capacity: POLL_INTERVAL_MS_AT_CAPACITY,
  // 0 = disabled. When > 0, at-capacity loops send per-work-item heartbeats
  // at this interval. Independent of poll_interval_ms_at_capacity — both may
  // run (heartbeat periodically yields to poll). 60s gives 5× headroom under
  // the server's 300s heartbeat TTL. Named non_exclusive to distinguish from
  // the old heartbeat_interval_ms field (either-or semantics in pre-#22145
  // clients — heartbeat suppressed poll). Old clients ignore this key; ops
  // can set both fields during rollout.
  non_exclusive_heartbeat_interval_ms: 0,
  multisession_poll_interval_ms_not_at_capacity:
    MULTISESSION_POLL_INTERVAL_MS_NOT_AT_CAPACITY,
  multisession_poll_interval_ms_partial_capacity:
    MULTISESSION_POLL_INTERVAL_MS_PARTIAL_CAPACITY,
  multisession_poll_interval_ms_at_capacity:
    MULTISESSION_POLL_INTERVAL_MS_AT_CAPACITY,
  // Poll query param: reclaim unacknowledged work items older than this.
  // Matches the server's DEFAULT_RECLAIM_OLDER_THAN_MS (work_service.py:24).
  // Enables picking up stale-pending work after JWT expiry, when the prior
  // ack failed because the session_ingress_token was already stale.
  reclaim_older_than_ms: 5000,
  // 0 = disabled. When > 0, push a silent {type:'keep_alive'} frame to
  // session-ingress at this interval so upstream proxies don't GC an idle
  // remote-control session. 2 min is the default. _v2: bridge-only gate
  // (pre-v2 clients read the old key, new clients ignore it).
  session_keepalive_interval_v2_ms: 120_000,
}
