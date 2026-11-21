import { z } from 'zod/v4'
import { getFeatureValue_DEPRECATED } from '../services/analytics/growthbook.js'
import { lazySchema } from '../utils/lazySchema.js'
import { lt } from '../utils/semver.js'
import { isEnvLessBridgeEnabled } from './bridgeEnabled.js'

export type EnvLessBridgeConfig = {
  // withRetry — init-phase backoff (createSession, POST /bridge, recovery /bridge)
  init_retry_max_attempts: number
  init_retry_base_delay_ms: number
  init_retry_jitter_fraction: number
  init_retry_max_delay_ms: number
  // axios timeout for POST /sessions, POST /bridge, POST /archive
  http_timeout_ms: number
  // BoundedUUIDSet ring size (echo + re-delivery dedup)
  uuid_dedup_buffer_size: number
  // CCRClient worker heartbeat cadence. Server TTL is 60s — 20s gives 3× margin.
  heartbeat_interval_ms: number
  // ±fraction of interval — per-beat jitter to spread fleet load.
  heartbeat_jitter_fraction: number
  // Fire proactive JWT refresh this long before expires_in. Larger buffer =
  // more frequent refresh (refresh cadence ≈ expires_in - buffer).
  token_refresh_buffer_ms: number
  // Archive POST timeout in teardown(). Distinct from http_timeout_ms because
  // gracefulShutdown races runCleanupFunctions() against a 2s cap — a 10s
  // axios timeout on a slow/stalled archive burns the whole budget on a
  // request that forceExit will kill anyway.
  teardown_archive_timeout_ms: number
  // Deadline for onConnect after transport.connect(). If neither onConnect
  // nor onClose fires before this, emit tengu_bridge_repl_connect_timeout
  // — the only telemetry for the ~1% of sessions that emit `started` then
  // go silent (no error, no event, just nothing).
  connect_timeout_ms: number
  // Semver floor for the env-less bridge path. Separate from the v1
  // tengu_bridge_min_version config so a v2-specific bug can force upgrades
  // without blocking v1 (env-based) clients, and vice versa.
  min_version: string
  // When true, tell users their claude.ai app may be too old to see v2
  // sessions — lets us roll the v2 bridge before the app ships the new
  // session-list query.
  should_show_app_upgrade_message: boolean
}

export const DEFAULT_ENV_LESS_BRIDGE_CONFIG: EnvLessBridgeConfig = {
  init_retry_max_attempts: 3,
  init_retry_base_delay_ms: 500,
  init_retry_jitter_fraction: 0.25,
  init_retry_max_delay_ms: 4000,
  http_timeout_ms: 10_000,
  uuid_dedup_buffer_size: 2000,
  heartbeat_interval_ms: 20_000,
  heartbeat_jitter_fraction: 0.1,
  token_refresh_buffer_ms: 300_000,
  teardown_archive_timeout_ms: 1500,
  connect_timeout_ms: 15_000,
  min_version: '0.0.0',
  should_show_app_upgrade_message: false,
}

// Floors reject the whole object on violation (fall back to DEFAULT) rather
// than partially trusting — same defense-in-depth as pollConfig.ts.
const envLessBridgeConfigSchema = lazySchema(() =>
  z.object({
    init_retry_max_attempts: z.number().int().min(1).max(10).default(3),
    init_retry_base_delay_ms: z.number().int().min(100).default(500),
    init_retry_jitter_fraction: z.number().min(0).max(1).default(0.25),
    init_retry_max_delay_ms: z.number().int().min(500).default(4000),
    http_timeout_ms: z.number().int().min(2000).default(10_000),
    uuid_dedup_buffer_size: z.number().int().min(100).max(50_000).default(2000),
    // Server TTL is 60s. Floor 5s prevents thrash; cap 30s keeps ≥2× margin.
    heartbeat_interval_ms: z
      .number()
      .int()
      .min(5000)
      .max(30_000)
      .default(20_000),
    // ±fraction per beat. Cap 0.5: at max interval (30s) × 1.5 = 45s worst case,
    // still under the 60s TTL.
    heartbeat_jitter_fraction: z.number().min(0).max(0.5).default(0.1),
    // Floor 30s prevents tight-looping. Cap 30min rejects buffer-vs-delay
    // semantic inversion: ops entering expires_in-5min (the *delay until
    // refresh*) instead of 5min (the *buffer before expiry*) yields
    // delayMs = expires_in - buffer ≈ 5min instead of ≈4h. Both are positive
    // durations so .min() alone can't distinguish; .max() catches the
    // inverted value since buffer ≥ 30min is nonsensical for a multi-hour JWT.
    token_refresh_buffer_ms: z
      .number()
      .int()
      .min(30_000)
      .max(1_800_000)
      .default(300_000),
    // Cap 2000 keeps this under gracefulShutdown's 2s cleanup race — a higher
    // timeout just lies to axios since forceExit kills the socket regardless.
    teardown_archive_timeout_ms: z
      .number()
      .int()
      .min(500)
      .max(2000)
      .default(1500),
    // Observed p99 connect is ~2-3s; 15s is ~5× headroom. Floor 5s bounds
    // false-positive rate under transient slowness; cap 60s bounds how long
    // a truly-stalled session stays dark.
    connect_timeout_ms: z.number().int().min(5_000).max(60_000).default(15_000),
    min_version: z
      .string()
      .refine(v => {
        try {
          lt(v, '0.0.0')
          return true
        } catch {
          return false
        }
      })
      .default('0.0.0'),
    should_show_app_upgrade_message: z.boolean().default(false),
  }),
)

/**
 * Fetch the env-less bridge timing config from GrowthBook. Read once per
 * initEnvLessBridgeCore call — config is fixed for the lifetime of a bridge
 * session.
 *
 * Uses the blocking getter (not _CACHED_MAY_BE_STALE) because /remote-control
 * runs well after GrowthBook init — initializeGrowthBook() resolves instantly,
 * so there's no startup penalty, and we get the fresh in-memory remoteEval
 * value instead of the stale-on-first-read disk cache. The _DEPRECATED suffix
 * warns against startup-path usage, which this isn't.
 */
export async function getEnvLessBridgeConfig(): Promise<EnvLessBridgeConfig> {
  const raw = await getFeatureValue_DEPRECATED<unknown>(
    'tengu_bridge_repl_v2_config',
    DEFAULT_ENV_LESS_BRIDGE_CONFIG,
  )
  const parsed = envLessBridgeConfigSchema().safeParse(raw)
  return parsed.success ? parsed.data : DEFAULT_ENV_LESS_BRIDGE_CONFIG
}

/**
 * Returns an error message if the current CLI version is below the minimum
 * required for the env-less (v2) bridge path, or null if the version is fine.
 *
 * v2 analogue of checkBridgeMinVersion() — reads from tengu_bridge_repl_v2_config
 * instead of tengu_bridge_min_version so the two implementations can enforce
 * independent floors.
 */
export async function checkEnvLessBridgeMinVersion(): Promise<string | null> {
  const cfg = await getEnvLessBridgeConfig()
  if (cfg.min_version && lt(MACRO.VERSION, cfg.min_version)) {
    return `Your version of Claude Code (${MACRO.VERSION}) is too old for Remote Control.\nVersion ${cfg.min_version} or higher is required. Run \`claude update\` to update.`
  }
  return null
}

/**
 * Whether to nudge users toward upgrading their claude.ai app when a
 * Remote Control session starts. True only when the v2 bridge is active
 * AND the should_show_app_upgrade_message config bit is set — lets us
 * roll the v2 bridge before the app ships the new session-list query.
 */
export async function shouldShowAppUpgradeMessage(): Promise<boolean> {
  if (!isEnvLessBridgeEnabled()) return false
  const cfg = await getEnvLessBridgeConfig()
  return cfg.should_show_app_upgrade_message
}
