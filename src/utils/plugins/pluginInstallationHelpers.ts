/**
 * Shared helper functions for plugin installation
 *
 * This module contains common utilities used across the plugin installation
 * system to reduce code duplication and improve maintainability.
 */

import { randomBytes } from 'crypto'
import { rename, rm } from 'fs/promises'
import { dirname, join, resolve, sep } from 'path'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED,
  logEvent,
} from '../../services/analytics/index.js'
import { getCwd } from '../cwd.js'
import { toError } from '../errors.js'
import { getFsImplementation } from '../fsOperations.js'
import { logError } from '../log.js'
import {
  getSettingsForSource,
  updateSettingsForSource,
} from '../settings/settings.js'
import { buildPluginTelemetryFields } from '../telemetry/pluginTelemetry.js'
import { clearAllCaches } from './cacheUtils.js'
import {
  formatDependencyCountSuffix,
  getEnabledPluginIdsForScope,
  type ResolutionResult,
  resolveDependencyClosure,
} from './dependencyResolver.js'
import {
  addInstalledPlugin,
  getGitCommitSha,
} from './installedPluginsManager.js'
import { getManagedPluginNames } from './managedPlugins.js'
import { getMarketplaceCacheOnly, getPluginById } from './marketplaceManager.js'
import {
  isOfficialMarketplaceName,
  parsePluginIdentifier,
  scopeToSettingSource,
} from './pluginIdentifier.js'
import {
  cachePlugin,
  getVersionedCachePath,
  getVersionedZipCachePath,
} from './pluginLoader.js'
import { isPluginBlockedByPolicy } from './pluginPolicy.js'
import { calculatePluginVersion } from './pluginVersioning.js'
import {
  isLocalPluginSource,
  type PluginMarketplaceEntry,
  type PluginScope,
  type PluginSource,
} from './schemas.js'
import {
  convertDirectoryToZipInPlace,
  isPluginZipCacheEnabled,
} from './zipCache.js'

/**
 * Plugin installation metadata for installed_plugins.json
 */
export type PluginInstallationInfo = {
  pluginId: string
  installPath: string
  version?: string
}

/**
 * Get current ISO timestamp
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Validate that a resolved path stays within a base directory.
 * Prevents path traversal attacks where malicious paths like './../../../etc/passwd'
 * could escape the expected directory.
 *
 * @param basePath - The base directory that the resolved path must stay within
 * @param relativePath - The relative path to validate
 * @returns The validated absolute path
 * @throws Error if the path would escape the base directory
 */
export function validatePathWithinBase(
  basePath: string,
  relativePath: string,
): string {
  const resolvedPath = resolve(basePath, relativePath)
  const normalizedBase = resolve(basePath) + sep

  // Check if the resolved path starts with the base path
  // Adding sep ensures we don't match partial directory names
  // e.g., /foo/bar should not match /foo/barbaz
  if (
    !resolvedPath.startsWith(normalizedBase) &&
    resolvedPath !== resolve(basePath)
  ) {
    throw new Error(
      `Path traversal detected: "${relativePath}" would escape the base directory`,
    )
  }

  return resolvedPath
}

/**
 * Cache a plugin (local or external) and add it to installed_plugins.json
 *
 * This function combines the common pattern of:
 * 1. Caching a plugin to ~/.claude/plugins/cache/
 * 2. Adding it to the installed plugins registry
 *
 * Both local plugins (with string source like "./path") and external plugins
 * (with object source like {source: "github", ...}) are cached to the same
 * location to ensure consistent behavior.
 *
 * @param pluginId - Plugin ID in "plugin@marketplace" format
 * @param entry - Plugin marketplace entry
 * @param scope - Installation scope (user, project, local, or managed). Defaults to 'user'.
 *                'managed' scope is used for plugins installed automatically from managed settings.
 * @param projectPath - Project path (required for project/local scopes)
 * @param localSourcePath - For local plugins, the resolved absolute path to the source directory
 * @returns The installation path
 */
export async function cacheAndRegisterPlugin(
  pluginId: string,
  entry: PluginMarketplaceEntry,
  scope: PluginScope = 'user',
  projectPath?: string,
  localSourcePath?: string,
): Promise<string> {
  // For local plugins, we need the resolved absolute path
  // Cast to PluginSource since cachePlugin handles any string path at runtime
  const source: PluginSource =
    typeof entry.source === 'string' && localSourcePath
      ? (localSourcePath as PluginSource)
      : entry.source

  const cacheResult = await cachePlugin(source, {
    manifest: entry as PluginMarketplaceEntry,
  })

  // For local plugins, use the original source path for Git SHA calculation
  // because the cached temp directory doesn't have .git (it's copied from a
  // subdirectory of the marketplace git repo). For external plugins, use the
  // cached path. For git-subdir sources, cachePlugin already captured the SHA
  // before discarding the ephemeral clone (the extracted subdir has no .git).
  const pathForGitSha = localSourcePath || cacheResult.path
  const gitCommitSha =
    cacheResult.gitCommitSha ?? (await getGitCommitSha(pathForGitSha))

  const now = getCurrentTimestamp()
  const version = await calculatePluginVersion(
    pluginId,
    entry.source,
    cacheResult.manifest,
    pathForGitSha,
    entry.version,
    cacheResult.gitCommitSha,
  )

  // Move the cached plugin to the versioned path: cache/marketplace/plugin/version/
  const versionedPath = getVersionedCachePath(pluginId, version)
  let finalPath = cacheResult.path

  // Only move if the paths are different and plugin was cached to a different location
  if (cacheResult.path !== versionedPath) {
    // Create the versioned directory structure
    await getFsImplementation().mkdir(dirname(versionedPath))

    // Remove existing versioned path if present (force: no-op if missing)
    await rm(versionedPath, { recursive: true, force: true })

    // Check if versionedPath is a subdirectory of cacheResult.path
    // This happens when marketplace name equals plugin name (e.g., "exa-mcp-server@exa-mcp-server")
    // In this case, we can't directly rename because we'd be moving a directory into itself
    const normalizedCachePath = cacheResult.path.endsWith(sep)
      ? cacheResult.path
      : cacheResult.path + sep
    const isSubdirectory = versionedPath.startsWith(normalizedCachePath)

    if (isSubdirectory) {
      // Move to a temp location first, then to final destination
      // We can't directly rename/copy a directory into its own subdirectory
      // Use the parent of cacheResult.path (same filesystem) to avoid EXDEV
      // errors when /tmp is on a different filesystem (e.g., tmpfs)
      const tempPath = join(
        dirname(cacheResult.path),
        `.claude-plugin-temp-${Date.now()}-${randomBytes(4).toString('hex')}`,
      )
      await rename(cacheResult.path, tempPath)
      await getFsImplementation().mkdir(dirname(versionedPath))
      await rename(tempPath, versionedPath)
    } else {
      // Move the cached plugin to the versioned location
      await rename(cacheResult.path, versionedPath)
    }
    finalPath = versionedPath
  }

  // Zip cache mode: convert directory to ZIP and remove the directory
  if (isPluginZipCacheEnabled()) {
    const zipPath = getVersionedZipCachePath(pluginId, version)
    await convertDirectoryToZipInPlace(finalPath, zipPath)
    finalPath = zipPath
  }

  // Add to both V1 and V2 installed_plugins files with correct scope
  addInstalledPlugin(
    pluginId,
    {
      version,
      installedAt: now,
      lastUpdated: now,
      installPath: finalPath,
      gitCommitSha,
    },
    scope,
    projectPath,
  )

  return finalPath
}

/**
 * Register a plugin installation without caching
 *
 * Used for local plugins that are already on disk and don't need remote caching.
 * External plugins should use cacheAndRegisterPlugin() instead.
 *
 * @param info - Plugin installation information
 * @param scope - Installation scope (user, project, local, or managed). Defaults to 'user'.
 *                'managed' scope is used for plugins registered from managed settings.
 * @param projectPath - Project path (required for project/local scopes)
 */
export function registerPluginInstallation(
  info: PluginInstallationInfo,
  scope: PluginScope = 'user',
  projectPath?: string,
): void {
  const now = getCurrentTimestamp()
  addInstalledPlugin(
    info.pluginId,
    {
      version: info.version || 'unknown',
      installedAt: now,
      lastUpdated: now,
      installPath: info.installPath,
    },
    scope,
    projectPath,
  )
}

/**
 * Parse plugin ID into components
 *
 * @param pluginId - Plugin ID in "plugin@marketplace" format
 * @returns Parsed components or null if invalid
 */
export function parsePluginId(
  pluginId: string,
): { name: string; marketplace: string } | null {
  const parts = pluginId.split('@')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null
  }

  return {
    name: parts[0],
    marketplace: parts[1],
  }
}

/**
 * Structured result from the install core. Wrappers format messages and
 * handle analytics/error-catching around this.
 */
export type InstallCoreResult =
  | { ok: true; closure: string[]; depNote: string }
  | { ok: false; reason: 'local-source-no-location'; pluginName: string }
  | { ok: false; reason: 'settings-write-failed'; message: string }
  | {
      ok: false
      reason: 'resolution-failed'
      resolution: ResolutionResult & { ok: false }
    }
  | { ok: false; reason: 'blocked-by-policy'; pluginName: string }
  | {
      ok: false
      reason: 'dependency-blocked-by-policy'
      pluginName: string
      blockedDependency: string
    }

/**
 * Format a failed ResolutionResult into a user-facing message. Unified on
 * the richer CLI messages (the "Is the X marketplace added?" hint is useful
 * for UI users too).
 */
export function formatResolutionError(
  r: ResolutionResult & { ok: false },
): string {
  switch (r.reason) {
    case 'cycle':
      return `Dependency cycle: ${r.chain.join(' → ')}`
    case 'cross-marketplace': {
      const depMkt = parsePluginIdentifier(r.dependency).marketplace
      const where = depMkt
        ? `marketplace "${depMkt}"`
        : 'a different marketplace'
      const hint = depMkt
        ? ` Add "${depMkt}" to allowCrossMarketplaceDependenciesOn in the ROOT marketplace's marketplace.json (the marketplace of the plugin you're installing — only its allowlist applies; no transitive trust).`
        : ''
      return `Dependency "${r.dependency}" (required by ${r.requiredBy}) is in ${where}, which is not in the allowlist — cross-marketplace dependencies are blocked by default. Install it manually first.${hint}`
    }
    case 'not-found': {
      const { marketplace: depMkt } = parsePluginIdentifier(r.missing)
      return depMkt
        ? `Dependency "${r.missing}" (required by ${r.requiredBy}) not found. Is the "${depMkt}" marketplace added?`
        : `Dependency "${r.missing}" (required by ${r.requiredBy}) not found in any configured marketplace`
    }
  }
}

/**
 * Core plugin install logic, shared by the CLI path (`installPluginOp`) and
 * the interactive UI path (`installPluginFromMarketplace`). Given a
 * pre-resolved marketplace entry, this:
 *
 *   1. Guards against local-source plugins without a marketplace install
 *      location (would silently no-op otherwise).
 *   2. Resolves the transitive dependency closure (when PLUGIN_DEPENDENCIES
 *      is on; trivial single-plugin closure otherwise).
 *   3. Writes the entire closure to enabledPlugins in one settings update.
 *   4. Caches each closure member (downloads/copies sources as needed).
 *   5. Clears memoization caches.
 *
 * Returns a structured result. Message formatting, analytics, and top-level
 * error wrapping stay in the caller-specific wrappers.
 *
 * @param marketplaceInstallLocation Pass this if the caller already has it
 *   (from a prior marketplace search) to avoid a redundant lookup.
 */
export async function installResolvedPlugin({
  pluginId,
  entry,
  scope,
  marketplaceInstallLocation,
}: {
  pluginId: string
  entry: PluginMarketplaceEntry
  scope: 'user' | 'project' | 'local'
  marketplaceInstallLocation?: string
}): Promise<InstallCoreResult> {
  const settingSource = scopeToSettingSource(scope)

  // ── Policy guard ──
  // Org-blocked plugins (managed-settings.json enabledPlugins: false) cannot
  // be installed. Checked here so all install paths (CLI, UI, hint-triggered)
  // are covered in one place.
  if (isPluginBlockedByPolicy(pluginId)) {
    return { ok: false, reason: 'blocked-by-policy', pluginName: entry.name }
  }

  // ── Resolve dependency closure ──
  // depInfo caches marketplace lookups so the materialize loop doesn't
  // re-fetch. Seed the root if the caller gave us its install location.
  const depInfo = new Map<
    string,
    { entry: PluginMarketplaceEntry; marketplaceInstallLocation: string }
  >()
  // Without this guard, a local-source root with undefined
  // marketplaceInstallLocation falls through: depInfo isn't seeded, the
  // materialize loop's `if (!info) continue` skips the root, and the user
  // sees "Successfully installed" while nothing is cached.
  if (isLocalPluginSource(entry.source) && !marketplaceInstallLocation) {
    return {
      ok: false,
      reason: 'local-source-no-location',
      pluginName: entry.name,
    }
  }
  if (marketplaceInstallLocation) {
    depInfo.set(pluginId, { entry, marketplaceInstallLocation })
  }

  const rootMarketplace = parsePluginIdentifier(pluginId).marketplace
  const allowedCrossMarketplaces = new Set(
    (rootMarketplace
      ? (await getMarketplaceCacheOnly(rootMarketplace))
          ?.allowCrossMarketplaceDependenciesOn
      : undefined) ?? [],
  )
  const resolution = await resolveDependencyClosure(
    pluginId,
    async id => {
      if (depInfo.has(id)) return depInfo.get(id)!.entry
      if (id === pluginId) return entry
      const info = await getPluginById(id)
      if (info) depInfo.set(id, info)
      return info?.entry ?? null
    },
    getEnabledPluginIdsForScope(settingSource),
    allowedCrossMarketplaces,
  )
  if (!resolution.ok) {
    return { ok: false, reason: 'resolution-failed', resolution }
  }

  // ── Policy guard for transitive dependencies ──
  // The root plugin was already checked above, but any dependency in the
  // closure could also be policy-blocked. Check before writing to settings
  // so a non-blocked plugin can't pull in a blocked dependency.
  for (const id of resolution.closure) {
    if (id !== pluginId && isPluginBlockedByPolicy(id)) {
      return {
        ok: false,
        reason: 'dependency-blocked-by-policy',
        pluginName: entry.name,
        blockedDependency: id,
      }
    }
  }

  // ── ACTION: write entire closure to settings in one call ──
  const closureEnabled: Record<string, true> = {}
  for (const id of resolution.closure) closureEnabled[id] = true
  const { error } = updateSettingsForSource(settingSource, {
    enabledPlugins: {
      ...getSettingsForSource(settingSource)?.enabledPlugins,
      ...closureEnabled,
    },
  })
  if (error) {
    return {
      ok: false,
      reason: 'settings-write-failed',
      message: error.message,
    }
  }

  // ── Materialize: cache each closure member ──
  const projectPath = scope !== 'user' ? getCwd() : undefined
  for (const id of resolution.closure) {
    let info = depInfo.get(id)
    // Root wasn't pre-seeded (caller didn't pass marketplaceInstallLocation
    // for a non-local source). Fetch now; it's needed for the cache write.
    if (!info && id === pluginId) {
      const mktLocation = (await getPluginById(id))?.marketplaceInstallLocation
      if (mktLocation) info = { entry, marketplaceInstallLocation: mktLocation }
    }
    if (!info) continue

    let localSourcePath: string | undefined
    const { source } = info.entry
    if (isLocalPluginSource(source)) {
      localSourcePath = validatePathWithinBase(
        info.marketplaceInstallLocation,
        source,
      )
    }
    await cacheAndRegisterPlugin(
      id,
      info.entry,
      scope,
      projectPath,
      localSourcePath,
    )
  }

  clearAllCaches()

  const depNote = formatDependencyCountSuffix(
    resolution.closure.filter(id => id !== pluginId),
  )
  return { ok: true, closure: resolution.closure, depNote }
}

/**
 * Result of a plugin installation operation
 */
export type InstallPluginResult =
  | { success: true; message: string }
  | { success: false; error: string }

/**
 * Parameters for installing a plugin from marketplace
 */
export type InstallPluginParams = {
  pluginId: string
  entry: PluginMarketplaceEntry
  marketplaceName: string
  scope?: 'user' | 'project' | 'local'
  trigger?: 'hint' | 'user'
}

/**
 * Install a single plugin from a marketplace with the specified scope.
 * Interactive-UI wrapper around `installResolvedPlugin` — adds try/catch,
 * analytics, and UI-style message formatting.
 */
export async function installPluginFromMarketplace({
  pluginId,
  entry,
  marketplaceName,
  scope = 'user',
  trigger = 'user',
}: InstallPluginParams): Promise<InstallPluginResult> {
  try {
    // Look up the marketplace install location for local-source plugins.
    // Without this, plugins with relative-path sources fail from the
    // interactive UI path (/plugin install) even though the CLI path works.
    const pluginInfo = await getPluginById(pluginId)
    const marketplaceInstallLocation = pluginInfo?.marketplaceInstallLocation

    const result = await installResolvedPlugin({
      pluginId,
      entry,
      scope,
      marketplaceInstallLocation,
    })

    if (!result.ok) {
      switch (result.reason) {
        case 'local-source-no-location':
          return {
            success: false,
            error: `Cannot install local plugin "${result.pluginName}" without marketplace install location`,
          }
        case 'settings-write-failed':
          return {
            success: false,
            error: `Failed to update settings: ${result.message}`,
          }
        case 'resolution-failed':
          return {
            success: false,
            error: formatResolutionError(result.resolution),
          }
        case 'blocked-by-policy':
          return {
            success: false,
            error: `Plugin "${result.pluginName}" is blocked by your organization's policy and cannot be installed`,
          }
        case 'dependency-blocked-by-policy':
          return {
            success: false,
            error: `Cannot install "${result.pluginName}": dependency "${result.blockedDependency}" is blocked by your organization's policy`,
          }
      }
    }

    // _PROTO_* routes to PII-tagged plugin_name/marketplace_name BQ columns.
    // plugin_id kept in additional_metadata (redacted to 'third-party' for
    // non-official) because dbt external_claude_code_plugin_installs.sql
    // extracts $.plugin_id for official-marketplace install tracking. Other
    // plugin lifecycle events drop the blob key — no downstream consumers.
    logEvent('tengu_plugin_installed', {
      _PROTO_plugin_name:
        entry.name as AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED,
      _PROTO_marketplace_name:
        marketplaceName as AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED,
      plugin_id: (isOfficialMarketplaceName(marketplaceName)
        ? pluginId
        : 'third-party') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      trigger:
        trigger as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      install_source: (trigger === 'hint'
        ? 'ui-suggestion'
        : 'ui-discover') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      ...buildPluginTelemetryFields(
        entry.name,
        marketplaceName,
        getManagedPluginNames(),
      ),
      ...(entry.version && {
        version:
          entry.version as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      }),
    })

    return {
      success: true,
      message: `✓ Installed ${entry.name}${result.depNote}. Run /reload-plugins to activate.`,
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    logError(toError(err))
    return { success: false, error: `Failed to install: ${errorMessage}` }
  }
}
