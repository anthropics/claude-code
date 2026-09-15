// GrowthBook-backed cron jitter configuration.
//
// Separated from cronScheduler.ts so the scheduler can be bundled in the
// Agent SDK public build without pulling in analytics/growthbook.ts and
// its large transitive dependency set (settings/hooks/config cycle).
//
// Usage:
//   REPL (useScheduledTasks.ts): pass `getJitterConfig: getCronJitterConfig`
//   Daemon/SDK: omit getJitterConfig → DEFAULT_CRON_JITTER_CONFIG applies.

import { z } from 'zod/v4'
import { getFeatureValue_CACHED_WITH_REFRESH } from '../services/analytics/growthbook.js'
import {
  type CronJitterConfig,
  DEFAULT_CRON_JITTER_CONFIG,
} from './cronTasks.js'
import { lazySchema } from './lazySchema.js'

// How often to re-fetch tengu_kairos_cron_config from GrowthBook. Short because
// this is an incident lever — when we push a config change to shed :00 load,
// we want the fleet to converge within a minute, not on the next process
// restart. The underlying call is a synchronous cache read; the refresh just
// clears the memoized entry so the next read triggers a background fetch.
const JITTER_CONFIG_REFRESH_MS = 60 * 1000

// Upper bounds here are defense-in-depth against fat-fingered GrowthBook
// pushes. Like pollConfig.ts, Zod rejects the whole object on any violation
// rather than partially trusting it — a config with one bad field falls back
// to DEFAULT_CRON_JITTER_CONFIG entirely. oneShotFloorMs shares oneShotMaxMs's
// ceiling (floor > max would invert the jitter range) and is cross-checked in
// the refine; the shared ceiling keeps the individual bound explicit in the
// error path. recurringMaxAgeMs uses .default() so a pre-existing GB config
// without the field doesn't get wholesale-rejected — the other fields were
// added together at config inception and don't need this.
const HALF_HOUR_MS = 30 * 60 * 1000
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const cronJitterConfigSchema = lazySchema(() =>
  z
    .object({
      recurringFrac: z.number().min(0).max(1),
      recurringCapMs: z.number().int().min(0).max(HALF_HOUR_MS),
      oneShotMaxMs: z.number().int().min(0).max(HALF_HOUR_MS),
      oneShotFloorMs: z.number().int().min(0).max(HALF_HOUR_MS),
      oneShotMinuteMod: z.number().int().min(1).max(60),
      recurringMaxAgeMs: z
        .number()
        .int()
        .min(0)
        .max(THIRTY_DAYS_MS)
        .default(DEFAULT_CRON_JITTER_CONFIG.recurringMaxAgeMs),
    })
    .refine(c => c.oneShotFloorMs <= c.oneShotMaxMs),
)

/**
 * Read `tengu_kairos_cron_config` from GrowthBook, validate, fall back to
 * defaults on absent/malformed/out-of-bounds config. Called from check()
 * every tick via the `getJitterConfig` callback — cheap (synchronous cache
 * hit). Refresh window: JITTER_CONFIG_REFRESH_MS.
 *
 * Exported so ops runbooks can point at a single function when documenting
 * the lever, and so tests can spy on it without mocking GrowthBook itself.
 *
 * Pass this as `getJitterConfig` when calling createCronScheduler in REPL
 * contexts. Daemon/SDK callers omit getJitterConfig and get defaults.
 */
export function getCronJitterConfig(): CronJitterConfig {
  const raw = getFeatureValue_CACHED_WITH_REFRESH<unknown>(
    'tengu_kairos_cron_config',
    DEFAULT_CRON_JITTER_CONFIG,
    JITTER_CONFIG_REFRESH_MS,
  )
  const parsed = cronJitterConfigSchema().safeParse(raw)
  return parsed.success ? parsed.data : DEFAULT_CRON_JITTER_CONFIG
}
