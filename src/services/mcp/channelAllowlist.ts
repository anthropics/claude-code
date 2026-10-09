/**
 * Approved channel plugins allowlist. --channels plugin:name@marketplace
 * entries only register if {marketplace, plugin} is on this list. server:
 * entries always fail (schema is plugin-only). The
 * --dangerously-load-development-channels flag bypasses for both kinds.
 * Lives in GrowthBook so it can be updated without a release.
 *
 * Plugin-level granularity: if a plugin is approved, all its channel
 * servers are. Per-server gating was overengineering — a plugin that
 * sprouts a malicious second server is already compromised, and per-server
 * entries would break on harmless plugin refactors.
 *
 * The allowlist check is a pure {marketplace, plugin} comparison against
 * the user's typed tag. The gate's separate 'marketplace' step verifies
 * the tag matches what's actually installed before this check runs.
 */

import { z } from 'zod/v4'
import { lazySchema } from '../../utils/lazySchema.js'
import { parsePluginIdentifier } from '../../utils/plugins/pluginIdentifier.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../analytics/growthbook.js'

export type ChannelAllowlistEntry = {
  marketplace: string
  plugin: string
}

const ChannelAllowlistSchema = lazySchema(() =>
  z.array(
    z.object({
      marketplace: z.string(),
      plugin: z.string(),
    }),
  ),
)

export function getChannelAllowlist(): ChannelAllowlistEntry[] {
  const raw = getFeatureValue_CACHED_MAY_BE_STALE<unknown>(
    'tengu_harbor_ledger',
    [],
  )
  const parsed = ChannelAllowlistSchema().safeParse(raw)
  return parsed.success ? parsed.data : []
}

/**
 * Overall channels on/off. Checked before any per-server gating —
 * when false, --channels is a no-op and no handlers register.
 * Default false; GrowthBook 5-min refresh.
 */
export function isChannelsEnabled(): boolean {
  return getFeatureValue_CACHED_MAY_BE_STALE('tengu_harbor', false)
}

/**
 * Pure allowlist check keyed off the connection's pluginSource — for UI
 * pre-filtering so the IDE only shows "Enable channel?" for servers that will
 * actually pass the gate. Not a security boundary: channel_enable still runs
 * the full gate. Matches the allowlist comparison inside gateChannelServer()
 * but standalone (no session/marketplace coupling — those are tautologies
 * when the entry is derived from pluginSource).
 *
 * Returns false for undefined pluginSource (non-plugin server — can never
 * match the {marketplace, plugin}-keyed ledger) and for @-less sources
 * (builtin/inline — same reason).
 */
export function isChannelAllowlisted(
  pluginSource: string | undefined,
): boolean {
  if (!pluginSource) return false
  const { name, marketplace } = parsePluginIdentifier(pluginSource)
  if (!marketplace) return false
  return getChannelAllowlist().some(
    e => e.plugin === name && e.marketplace === marketplace,
  )
}
