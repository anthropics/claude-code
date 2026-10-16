/**
 * Plugin telemetry helpers — shared field builders for plugin lifecycle events.
 *
 * Implements the twin-column privacy pattern: every user-defined-name field
 * emits both a raw value (routed to PII-tagged _PROTO_* BQ columns) and a
 * redacted twin (real name iff marketplace ∈ allowlist, else 'third-party').
 *
 * plugin_id_hash provides an opaque per-plugin aggregation key with no privacy
 * dependency — sha256(name@marketplace + FIXED_SALT) truncated to 16 chars.
 * This answers distinct-count and per-plugin-trend questions that the
 * redacted column can't, without exposing user-defined names.
 */

import { createHash } from 'crypto'
import { sep } from 'path'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED,
  logEvent,
} from '../../services/analytics/index.js'
import type {
  LoadedPlugin,
  PluginError,
  PluginManifest,
} from '../../types/plugin.js'
import {
  isOfficialMarketplaceName,
  parsePluginIdentifier,
} from '../plugins/pluginIdentifier.js'

// builtinPlugins.ts:BUILTIN_MARKETPLACE_NAME — inlined to avoid the cycle
// through commands.js. Marketplace schemas.ts enforces 'builtin' is reserved.
const BUILTIN_MARKETPLACE_NAME = 'builtin'

// Fixed salt for plugin_id_hash. Same constant across all repos and emission
// sites. Not per-org, not rotated — per-org salt would defeat cross-org
// distinct-count, rotation would break trend lines. Customers can compute the
// same hash on their known plugin names to reverse-match their own telemetry.
const PLUGIN_ID_HASH_SALT = 'claude-plugin-telemetry-v1'

/**
 * Opaque per-plugin aggregation key. Input is the name@marketplace string as
 * it appears in enabledPlugins keys, lowercased on the marketplace suffix for
 * reproducibility. 16-char truncation keeps BQ GROUP BY cardinality manageable
 * while making collisions negligible at projected 10k-plugin scale. Name case
 * is preserved in both branches (enabledPlugins keys are case-sensitive).
 */
export function hashPluginId(name: string, marketplace?: string): string {
  const key = marketplace ? `${name}@${marketplace.toLowerCase()}` : name
  return createHash('sha256')
    .update(key + PLUGIN_ID_HASH_SALT)
    .digest('hex')
    .slice(0, 16)
}

/**
 * 4-value scope enum for plugin origin. Distinct from PluginScope
 * (managed/user/project/local) which is installation-target — this is
 * marketplace-origin.
 *
 * - official: from an allowlisted Anthropic marketplace
 * - default-bundle: ships with product (@builtin), auto-enabled
 * - org: enterprise admin-pushed via managed settings (policySettings)
 * - user-local: user added marketplace or local plugin
 */
export type TelemetryPluginScope =
  | 'official'
  | 'org'
  | 'user-local'
  | 'default-bundle'

export function getTelemetryPluginScope(
  name: string,
  marketplace: string | undefined,
  managedNames: Set<string> | null,
): TelemetryPluginScope {
  if (marketplace === BUILTIN_MARKETPLACE_NAME) return 'default-bundle'
  if (isOfficialMarketplaceName(marketplace)) return 'official'
  if (managedNames?.has(name)) return 'org'
  return 'user-local'
}

/**
 * How a plugin arrived in the session. Splits self-selected from org-pushed
 * — plugin_scope alone doesn't (an official plugin can be user-installed OR
 * org-pushed; both are scope='official').
 */
export type EnabledVia =
  | 'user-install'
  | 'org-policy'
  | 'default-enable'
  | 'seed-mount'

/** How a skill/command invocation was triggered. */
export type InvocationTrigger =
  | 'user-slash'
  | 'claude-proactive'
  | 'nested-skill'

/** Where a skill invocation executes. */
export type SkillExecutionContext = 'fork' | 'inline' | 'remote'

/** How a plugin install was initiated. */
export type InstallSource =
  | 'cli-explicit'
  | 'ui-discover'
  | 'ui-suggestion'
  | 'deep-link'

export function getEnabledVia(
  plugin: LoadedPlugin,
  managedNames: Set<string> | null,
  seedDirs: string[],
): EnabledVia {
  if (plugin.isBuiltin) return 'default-enable'
  if (managedNames?.has(plugin.name)) return 'org-policy'
  // Trailing sep: /opt/plugins must not match /opt/plugins-extra
  if (
    seedDirs.some(dir =>
      plugin.path.startsWith(dir.endsWith(sep) ? dir : dir + sep),
    )
  ) {
    return 'seed-mount'
  }
  return 'user-install'
}

/**
 * Common plugin telemetry fields keyed off name@marketplace. Returns the
 * hash, scope enum, and the redacted-twin columns. Callers add the raw
 * _PROTO_* fields separately (those require the PII-tagged marker type).
 */
export function buildPluginTelemetryFields(
  name: string,
  marketplace: string | undefined,
  managedNames: Set<string> | null = null,
): {
  plugin_id_hash: AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
  plugin_scope: AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
  plugin_name_redacted: AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
  marketplace_name_redacted: AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
  is_official_plugin: boolean
} {
  const scope = getTelemetryPluginScope(name, marketplace, managedNames)
  // Both official marketplaces and builtin plugins are Anthropic-controlled
  // — safe to expose real names in the redacted columns.
  const isAnthropicControlled =
    scope === 'official' || scope === 'default-bundle'
  return {
    plugin_id_hash: hashPluginId(
      name,
      marketplace,
    ) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    plugin_scope:
      scope as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    plugin_name_redacted: (isAnthropicControlled
      ? name
      : 'third-party') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    marketplace_name_redacted: (isAnthropicControlled && marketplace
      ? marketplace
      : 'third-party') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    is_official_plugin: isAnthropicControlled,
  }
}

/**
 * Per-invocation callers (SkillTool, processSlashCommand) pass
 * managedNames=null — the session-level tengu_plugin_enabled_for_session
 * event carries the authoritative plugin_scope, and per-invocation rows can
 * join on plugin_id_hash to recover it. This keeps hot-path call sites free
 * of the extra settings read.
 */
export function buildPluginCommandTelemetryFields(
  pluginInfo: { pluginManifest: PluginManifest; repository: string },
  managedNames: Set<string> | null = null,
): ReturnType<typeof buildPluginTelemetryFields> {
  const { marketplace } = parsePluginIdentifier(pluginInfo.repository)
  return buildPluginTelemetryFields(
    pluginInfo.pluginManifest.name,
    marketplace,
    managedNames,
  )
}

/**
 * Emit tengu_plugin_enabled_for_session once per enabled plugin at session
 * start. Supplements tengu_skill_loaded (which still fires per-skill) — use
 * this for plugin-level aggregates instead of DISTINCT-on-prefix hacks.
 * A plugin with 5 skills emits 5 skill_loaded rows but 1 of these.
 */
export function logPluginsEnabledForSession(
  plugins: LoadedPlugin[],
  managedNames: Set<string> | null,
  seedDirs: string[],
): void {
  for (const plugin of plugins) {
    const { marketplace } = parsePluginIdentifier(plugin.repository)

    logEvent('tengu_plugin_enabled_for_session', {
      _PROTO_plugin_name:
        plugin.name as AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED,
      ...(marketplace && {
        _PROTO_marketplace_name:
          marketplace as AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED,
      }),
      ...buildPluginTelemetryFields(plugin.name, marketplace, managedNames),
      enabled_via: getEnabledVia(
        plugin,
        managedNames,
        seedDirs,
      ) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      skill_path_count:
        (plugin.skillsPath ? 1 : 0) + (plugin.skillsPaths?.length ?? 0),
      command_path_count:
        (plugin.commandsPath ? 1 : 0) + (plugin.commandsPaths?.length ?? 0),
      has_mcp: plugin.manifest.mcpServers !== undefined,
      has_hooks: plugin.hooksConfig !== undefined,
      ...(plugin.manifest.version && {
        version: plugin.manifest
          .version as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      }),
    })
  }
}

/**
 * Bounded-cardinality error bucket for CLI plugin operation failures.
 * Maps free-form error messages to 5 stable categories so dashboard
 * GROUP BY stays tractable.
 */
export type PluginCommandErrorCategory =
  | 'network'
  | 'not-found'
  | 'permission'
  | 'validation'
  | 'unknown'

export function classifyPluginCommandError(
  error: unknown,
): PluginCommandErrorCategory {
  const msg = String((error as { message?: unknown })?.message ?? error)
  if (
    /ENOTFOUND|ECONNREFUSED|EAI_AGAIN|ETIMEDOUT|ECONNRESET|network|Could not resolve|Connection refused|timed out/i.test(
      msg,
    )
  ) {
    return 'network'
  }
  if (/\b404\b|not found|does not exist|no such plugin/i.test(msg)) {
    return 'not-found'
  }
  if (/\b40[13]\b|EACCES|EPERM|permission denied|unauthorized/i.test(msg)) {
    return 'permission'
  }
  if (/invalid|malformed|schema|validation|parse error/i.test(msg)) {
    return 'validation'
  }
  return 'unknown'
}

/**
 * Emit tengu_plugin_load_failed once per error surfaced by session-start
 * plugin loading. Pairs with tengu_plugin_enabled_for_session so dashboards
 * can compute a load-success rate. PluginError.type is already a bounded
 * enum — use it directly as error_category.
 */
export function logPluginLoadErrors(
  errors: PluginError[],
  managedNames: Set<string> | null,
): void {
  for (const err of errors) {
    const { name, marketplace } = parsePluginIdentifier(err.source)
    // Not all PluginError variants carry a plugin name (some have pluginId,
    // some are marketplace-level). Use the 'plugin' property if present,
    // fall back to the name parsed from err.source.
    const pluginName = 'plugin' in err && err.plugin ? err.plugin : name
    logEvent('tengu_plugin_load_failed', {
      error_category:
        err.type as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      _PROTO_plugin_name:
        pluginName as AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED,
      ...(marketplace && {
        _PROTO_marketplace_name:
          marketplace as AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED,
      }),
      ...buildPluginTelemetryFields(pluginName, marketplace, managedNames),
    })
  }
}
