/**
 * Manages plugin installation metadata stored in installed_plugins.json
 *
 * This module separates plugin installation state (global) from enabled/disabled
 * state (per-repository). The installed_plugins.json file tracks:
 * - Which plugins are installed globally
 * - Installation metadata (version, timestamps, paths)
 *
 * The enabled/disabled state remains in .claude/settings.json for per-repo control.
 *
 * Rationale: Installation is global (a plugin is either on disk or not), while
 * enabled/disabled state is per-repository (different projects may want different
 * plugins active).
 */

import { dirname, join } from 'path'
import { logForDebugging } from '../debug.js'
import { errorMessage, isENOENT, toError } from '../errors.js'
import { getFsImplementation } from '../fsOperations.js'
import { logError } from '../log.js'
import {
  jsonParse,
  jsonStringify,
  writeFileSync_DEPRECATED,
} from '../slowOperations.js'
import { getPluginsDirectory } from './pluginDirectories.js'
import {
  type InstalledPlugin,
  InstalledPluginsFileSchemaV1,
  InstalledPluginsFileSchemaV2,
  type InstalledPluginsFileV1,
  type InstalledPluginsFileV2,
  type PluginInstallationEntry,
  type PluginScope,
} from './schemas.js'

// Type alias for V2 plugins map
type InstalledPluginsMapV2 = Record<string, PluginInstallationEntry[]>

// Type for persistable scopes (excludes 'flag' which is session-only)
export type PersistableScope = Exclude<PluginScope, never> // All scopes are persistable in the schema

import { getOriginalCwd } from '../../bootstrap/state.js'
import { getCwd } from '../cwd.js'
import { getHeadForDir } from '../git/gitFilesystem.js'
import type { EditableSettingSource } from '../settings/constants.js'
import {
  getSettings_DEPRECATED,
  getSettingsForSource,
} from '../settings/settings.js'
import { getPluginById } from './marketplaceManager.js'
import {
  parsePluginIdentifier,
  settingSourceToScope,
} from './pluginIdentifier.js'
import { getPluginCachePath, getVersionedCachePath } from './pluginLoader.js'

// Migration state to prevent running migration multiple times per session
let migrationCompleted = false

/**
 * Memoized cache of installed plugins data (V2 format)
 * Cleared by clearInstalledPluginsCache() when file is modified.
 * Prevents repeated filesystem reads within a single CLI session.
 */
let installedPluginsCacheV2: InstalledPluginsFileV2 | null = null

/**
 * Session-level snapshot of installed plugins at startup.
 * This is what the running session uses - it's NOT updated by background operations.
 * Background updates modify the disk file only.
 */
let inMemoryInstalledPlugins: InstalledPluginsFileV2 | null = null

/**
 * Get the path to the installed_plugins.json file
 */
export function getInstalledPluginsFilePath(): string {
  return join(getPluginsDirectory(), 'installed_plugins.json')
}

/**
 * Get the path to the legacy installed_plugins_v2.json file.
 * Used only during migration to consolidate into single file.
 */
export function getInstalledPluginsV2FilePath(): string {
  return join(getPluginsDirectory(), 'installed_plugins_v2.json')
}

/**
 * Clear the installed plugins cache
 * Call this when the file is modified to force a reload
 *
 * Note: This also clears the in-memory session state (inMemoryInstalledPlugins).
 * In most cases, this is only called during initialization or testing.
 * For background updates, use updateInstallationPathOnDisk() which preserves
 * the in-memory state.
 */
export function clearInstalledPluginsCache(): void {
  installedPluginsCacheV2 = null
  inMemoryInstalledPlugins = null
  logForDebugging('Cleared installed plugins cache')
}

/**
 * Migrate to single plugin file format.
 *
 * This consolidates the V1/V2 dual-file system into a single file:
 * 1. If installed_plugins_v2.json exists: copy to installed_plugins.json (version=2), delete V2 file
 * 2. If only installed_plugins.json exists with version=1: convert to version=2 in-place
 * 3. Clean up legacy non-versioned cache directories
 *
 * This migration runs once per session at startup.
 */
export function migrateToSinglePluginFile(): void {
  if (migrationCompleted) {
    return
  }

  const fs = getFsImplementation()
  const mainFilePath = getInstalledPluginsFilePath()
  const v2FilePath = getInstalledPluginsV2FilePath()

  try {
    // Case 1: Try renaming v2→main directly; ENOENT = v2 doesn't exist
    try {
      fs.renameSync(v2FilePath, mainFilePath)
      logForDebugging(
        `Renamed installed_plugins_v2.json to installed_plugins.json`,
      )
      // Clean up legacy cache directories
      const v2Data = loadInstalledPluginsV2()
      cleanupLegacyCache(v2Data)
      migrationCompleted = true
      return
    } catch (e) {
      if (!isENOENT(e)) throw e
    }

    // Case 2: v2 absent — try reading main; ENOENT = neither exists (case 3)
    let mainContent: string
    try {
      mainContent = fs.readFileSync(mainFilePath, { encoding: 'utf-8' })
    } catch (e) {
      if (!isENOENT(e)) throw e
      // Case 3: No file exists - nothing to migrate
      migrationCompleted = true
      return
    }

    const mainData = jsonParse(mainContent)
    const version = typeof mainData?.version === 'number' ? mainData.version : 1

    if (version === 1) {
      // Convert V1 to V2 format in-place
      const v1Data = InstalledPluginsFileSchemaV1().parse(mainData)
      const v2Data = migrateV1ToV2(v1Data)

      writeFileSync_DEPRECATED(mainFilePath, jsonStringify(v2Data, null, 2), {
        encoding: 'utf-8',
        flush: true,
      })
      logForDebugging(
        `Converted installed_plugins.json from V1 to V2 format (${Object.keys(v1Data.plugins).length} plugins)`,
      )

      // Clean up legacy cache directories
      cleanupLegacyCache(v2Data)
    }
    // If version=2, already in correct format, no action needed

    migrationCompleted = true
  } catch (error) {
    const errorMsg = errorMessage(error)
    logForDebugging(`Failed to migrate plugin files: ${errorMsg}`, {
      level: 'error',
    })
    logError(toError(error))
    // Mark as completed to avoid retrying failed migration
    migrationCompleted = true
  }
}

/**
 * Clean up legacy non-versioned cache directories.
 *
 * Legacy cache structure: ~/.claude/plugins/cache/{plugin-name}/
 * Versioned cache structure: ~/.claude/plugins/cache/{marketplace}/{plugin}/{version}/
 *
 * This function removes legacy directories that are not referenced by any installation.
 */
function cleanupLegacyCache(v2Data: InstalledPluginsFileV2): void {
  const fs = getFsImplementation()
  const cachePath = getPluginCachePath()
  try {
    // Collect all install paths that are referenced
    const referencedPaths = new Set<string>()
    for (const installations of Object.values(v2Data.plugins)) {
      for (const entry of installations) {
        referencedPaths.add(entry.installPath)
      }
    }

    // List top-level directories in cache
    const entries = fs.readdirSync(cachePath)

    for (const dirent of entries) {
      if (!dirent.isDirectory()) {
        continue
      }

      const entry = dirent.name
      const entryPath = join(cachePath, entry)

      // Check if this is a versioned cache (marketplace dir with plugin/version subdirs)
      // or a legacy cache (flat plugin directory)
      const subEntries = fs.readdirSync(entryPath)
      const hasVersionedStructure = subEntries.some(subDirent => {
        if (!subDirent.isDirectory()) return false
        const subPath = join(entryPath, subDirent.name)
        // Check if subdir contains version directories (semver-like or hash)
        const versionEntries = fs.readdirSync(subPath)
        return versionEntries.some(vDirent => vDirent.isDirectory())
      })

      if (hasVersionedStructure) {
        // This is a marketplace directory with versioned structure - skip
        continue
      }

      // This is a legacy flat cache directory
      // Check if it's referenced by any installation
      if (!referencedPaths.has(entryPath)) {
        // Not referenced - safe to delete
        fs.rmSync(entryPath, { recursive: true, force: true })
        logForDebugging(`Cleaned up legacy cache directory: ${entry}`)
      }
    }
  } catch (error) {
    const errorMsg = errorMessage(error)
    logForDebugging(`Failed to clean up legacy cache: ${errorMsg}`, {
      level: 'warn',
    })
  }
}

/**
 * Reset migration state (for testing)
 */
export function resetMigrationState(): void {
  migrationCompleted = false
}

/**
 * Read raw file data from installed_plugins.json
 * Returns null if file doesn't exist.
 * Throws error if file exists but can't be parsed.
 */
function readInstalledPluginsFileRaw(): {
  version: number
  data: unknown
} | null {
  const fs = getFsImplementation()
  const filePath = getInstalledPluginsFilePath()

  let fileContent: string
  try {
    fileContent = fs.readFileSync(filePath, { encoding: 'utf-8' })
  } catch (e) {
    if (isENOENT(e)) {
      return null
    }
    throw e
  }
  const data = jsonParse(fileContent)
  const version = typeof data?.version === 'number' ? data.version : 1
  return { version, data }
}

/**
 * Migrate V1 data to V2 format.
 * All V1 plugins are migrated to 'user' scope since V1 had no scope concept.
 */
function migrateV1ToV2(v1Data: InstalledPluginsFileV1): InstalledPluginsFileV2 {
  const v2Plugins: InstalledPluginsMapV2 = {}

  for (const [pluginId, plugin] of Object.entries(v1Data.plugins)) {
    // V2 format uses versioned cache path: ~/.claude/plugins/cache/{marketplace}/{plugin}/{version}
    // Compute it from pluginId and version instead of using the V1 installPath
    const versionedCachePath = getVersionedCachePath(pluginId, plugin.version)

    v2Plugins[pluginId] = [
      {
        scope: 'user', // Default all existing installs to user scope
        installPath: versionedCachePath,
        version: plugin.version,
        installedAt: plugin.installedAt,
        lastUpdated: plugin.lastUpdated,
        gitCommitSha: plugin.gitCommitSha,
      },
    ]
  }

  return { version: 2, plugins: v2Plugins }
}

/**
 * Load installed plugins in V2 format.
 *
 * Reads from installed_plugins.json. If file has version=1,
 * converts to V2 format in memory.
 *
 * @returns V2 format data with array-per-plugin structure
 */
export function loadInstalledPluginsV2(): InstalledPluginsFileV2 {
  // Return cached V2 data if available
  if (installedPluginsCacheV2 !== null) {
    return installedPluginsCacheV2
  }

  const filePath = getInstalledPluginsFilePath()

  try {
    const rawData = readInstalledPluginsFileRaw()

    if (rawData) {
      if (rawData.version === 2) {
        // V2 format - validate and return
        const validated = InstalledPluginsFileSchemaV2().parse(rawData.data)
        installedPluginsCacheV2 = validated
        logForDebugging(
          `Loaded ${Object.keys(validated.plugins).length} installed plugins from ${filePath}`,
        )
        return validated
      }

      // V1 format - convert to V2
      const v1Validated = InstalledPluginsFileSchemaV1().parse(rawData.data)
      const v2Data = migrateV1ToV2(v1Validated)
      installedPluginsCacheV2 = v2Data
      logForDebugging(
        `Loaded and converted ${Object.keys(v1Validated.plugins).length} plugins from V1 format`,
      )
      return v2Data
    }

    // File doesn't exist - return empty V2
    logForDebugging(
      `installed_plugins.json doesn't exist, returning empty V2 object`,
    )
    installedPluginsCacheV2 = { version: 2, plugins: {} }
    return installedPluginsCacheV2
  } catch (error) {
    const errorMsg = errorMessage(error)
    logForDebugging(
      `Failed to load installed_plugins.json: ${errorMsg}. Starting with empty state.`,
      { level: 'error' },
    )
    logError(toError(error))

    installedPluginsCacheV2 = { version: 2, plugins: {} }
    return installedPluginsCacheV2
  }
}

/**
 * Save installed plugins in V2 format to installed_plugins.json.
 * This is the single source of truth after V1/V2 consolidation.
 */
function saveInstalledPluginsV2(data: InstalledPluginsFileV2): void {
  const fs = getFsImplementation()
  const filePath = getInstalledPluginsFilePath()

  try {
    fs.mkdirSync(getPluginsDirectory())

    const jsonContent = jsonStringify(data, null, 2)
    writeFileSync_DEPRECATED(filePath, jsonContent, {
      encoding: 'utf-8',
      flush: true,
    })

    // Update cache
    installedPluginsCacheV2 = data

    logForDebugging(
      `Saved ${Object.keys(data.plugins).length} installed plugins to ${filePath}`,
    )
  } catch (error) {
    const _errorMsg = errorMessage(error)
    logError(toError(error))
    throw error
  }
}

/**
 * Add or update a plugin installation entry at a specific scope.
 * Used for V2 format where each plugin has an array of installations.
 *
 * @param pluginId - Plugin ID in "plugin@marketplace" format
 * @param scope - Installation scope (managed/user/project/local)
 * @param installPath - Path to versioned plugin directory
 * @param metadata - Additional installation metadata
 * @param projectPath - Project path (required for project/local scopes)
 */
export function addPluginInstallation(
  pluginId: string,
  scope: PersistableScope,
  installPath: string,
  metadata: Partial<PluginInstallationEntry>,
  projectPath?: string,
): void {
  const data = loadInstalledPluginsFromDisk()

  // Get or create array for this plugin
  const installations = data.plugins[pluginId] || []

  // Find existing entry for this scope+projectPath
  const existingIndex = installations.findIndex(
    entry => entry.scope === scope && entry.projectPath === projectPath,
  )

  const newEntry: PluginInstallationEntry = {
    scope,
    installPath,
    version: metadata.version,
    installedAt: metadata.installedAt || new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    gitCommitSha: metadata.gitCommitSha,
    ...(projectPath && { projectPath }),
  }

  if (existingIndex >= 0) {
    installations[existingIndex] = newEntry
    logForDebugging(`Updated installation for ${pluginId} at scope ${scope}`)
  } else {
    installations.push(newEntry)
    logForDebugging(`Added installation for ${pluginId} at scope ${scope}`)
  }

  data.plugins[pluginId] = installations
  saveInstalledPluginsV2(data)
}

/**
 * Remove a plugin installation entry from a specific scope.
 *
 * @param pluginId - Plugin ID in "plugin@marketplace" format
 * @param scope - Installation scope to remove
 * @param projectPath - Project path (for project/local scopes)
 */
export function removePluginInstallation(
  pluginId: string,
  scope: PersistableScope,
  projectPath?: string,
): void {
  const data = loadInstalledPluginsFromDisk()
  const installations = data.plugins[pluginId]

  if (!installations) {
    return
  }

  data.plugins[pluginId] = installations.filter(
    entry => !(entry.scope === scope && entry.projectPath === projectPath),
  )

  // Remove plugin entirely if no installations left
  if (data.plugins[pluginId].length === 0) {
    delete data.plugins[pluginId]
  }

  saveInstalledPluginsV2(data)
  logForDebugging(`Removed installation for ${pluginId} at scope ${scope}`)
}

// =============================================================================
// In-Memory vs Disk State Management (for non-in-place updates)
// =============================================================================

/**
 * Get the in-memory installed plugins (session state).
 * This snapshot is loaded at startup and used for the entire session.
 * It is NOT updated by background operations.
 *
 * @returns V2 format data representing the session's view of installed plugins
 */
export function getInMemoryInstalledPlugins(): InstalledPluginsFileV2 {
  if (inMemoryInstalledPlugins === null) {
    inMemoryInstalledPlugins = loadInstalledPluginsV2()
  }
  return inMemoryInstalledPlugins
}

/**
 * Load installed plugins directly from disk, bypassing all caches.
 * Used by background updater to check for changes without affecting
 * the running session's view.
 *
 * @returns V2 format data read fresh from disk
 */
export function loadInstalledPluginsFromDisk(): InstalledPluginsFileV2 {
  try {
    // Read from main file
    const rawData = readInstalledPluginsFileRaw()

    if (rawData) {
      if (rawData.version === 2) {
        return InstalledPluginsFileSchemaV2().parse(rawData.data)
      }
      // V1 format - convert to V2
      const v1Data = InstalledPluginsFileSchemaV1().parse(rawData.data)
      return migrateV1ToV2(v1Data)
    }

    return { version: 2, plugins: {} }
  } catch (error) {
    const errorMsg = errorMessage(error)
    logForDebugging(`Failed to load installed plugins from disk: ${errorMsg}`, {
      level: 'error',
    })
    return { version: 2, plugins: {} }
  }
}

/**
 * Update a plugin's install path on disk only, without modifying in-memory state.
 * Used by background updater to record new version on disk while session
 * continues using the old version.
 *
 * @param pluginId - Plugin ID in "plugin@marketplace" format
 * @param scope - Installation scope
 * @param projectPath - Project path (for project/local scopes)
 * @param newPath - New install path (to new version directory)
 * @param newVersion - New version string
 */
export function updateInstallationPathOnDisk(
  pluginId: string,
  scope: PersistableScope,
  projectPath: string | undefined,
  newPath: string,
  newVersion: string,
  gitCommitSha?: string,
): void {
  const diskData = loadInstalledPluginsFromDisk()
  const installations = diskData.plugins[pluginId]

  if (!installations) {
    logForDebugging(
      `Cannot update ${pluginId} on disk: plugin not found in installed plugins`,
    )
    return
  }

  const entry = installations.find(
    e => e.scope === scope && e.projectPath === projectPath,
  )

  if (entry) {
    entry.installPath = newPath
    entry.version = newVersion
    entry.lastUpdated = new Date().toISOString()
    if (gitCommitSha !== undefined) {
      entry.gitCommitSha = gitCommitSha
    }

    const filePath = getInstalledPluginsFilePath()

    // Write to single file (V2 format with version=2)
    writeFileSync_DEPRECATED(filePath, jsonStringify(diskData, null, 2), {
      encoding: 'utf-8',
      flush: true,
    })

    // Clear cache since disk changed, but do NOT update inMemoryInstalledPlugins
    installedPluginsCacheV2 = null

    logForDebugging(
      `Updated ${pluginId} on disk to version ${newVersion} at ${newPath}`,
    )
  } else {
    logForDebugging(
      `Cannot update ${pluginId} on disk: no installation for scope ${scope}`,
    )
  }
  // Note: inMemoryInstalledPlugins is NOT updated
}

/**
 * Check if there are pending updates (disk differs from memory).
 * This happens when background updater has downloaded new versions.
 *
 * @returns true if any plugin has a different install path on disk vs memory
 */
export function hasPendingUpdates(): boolean {
  const memoryState = getInMemoryInstalledPlugins()
  const diskState = loadInstalledPluginsFromDisk()

  for (const [pluginId, diskInstallations] of Object.entries(
    diskState.plugins,
  )) {
    const memoryInstallations = memoryState.plugins[pluginId]
    if (!memoryInstallations) continue

    for (const diskEntry of diskInstallations) {
      const memoryEntry = memoryInstallations.find(
        m =>
          m.scope === diskEntry.scope &&
          m.projectPath === diskEntry.projectPath,
      )
      if (memoryEntry && memoryEntry.installPath !== diskEntry.installPath) {
        return true // Disk has different version than memory
      }
    }
  }

  return false
}

/**
 * Get the count of pending updates (installations where disk differs from memory).
 *
 * @returns Number of installations with pending updates
 */
export function getPendingUpdateCount(): number {
  let count = 0
  const memoryState = getInMemoryInstalledPlugins()
  const diskState = loadInstalledPluginsFromDisk()

  for (const [pluginId, diskInstallations] of Object.entries(
    diskState.plugins,
  )) {
    const memoryInstallations = memoryState.plugins[pluginId]
    if (!memoryInstallations) continue

    for (const diskEntry of diskInstallations) {
      const memoryEntry = memoryInstallations.find(
        m =>
          m.scope === diskEntry.scope &&
          m.projectPath === diskEntry.projectPath,
      )
      if (memoryEntry && memoryEntry.installPath !== diskEntry.installPath) {
        count++
      }
    }
  }

  return count
}

/**
 * Get details about pending updates for display.
 *
 * @returns Array of objects with pluginId, scope, oldVersion, newVersion
 */
export function getPendingUpdatesDetails(): Array<{
  pluginId: string
  scope: string
  oldVersion: string
  newVersion: string
}> {
  const updates: Array<{
    pluginId: string
    scope: string
    oldVersion: string
    newVersion: string
  }> = []

  const memoryState = getInMemoryInstalledPlugins()
  const diskState = loadInstalledPluginsFromDisk()

  for (const [pluginId, diskInstallations] of Object.entries(
    diskState.plugins,
  )) {
    const memoryInstallations = memoryState.plugins[pluginId]
    if (!memoryInstallations) continue

    for (const diskEntry of diskInstallations) {
      const memoryEntry = memoryInstallations.find(
        m =>
          m.scope === diskEntry.scope &&
          m.projectPath === diskEntry.projectPath,
      )
      if (memoryEntry && memoryEntry.installPath !== diskEntry.installPath) {
        updates.push({
          pluginId,
          scope: diskEntry.scope,
          oldVersion: memoryEntry.version || 'unknown',
          newVersion: diskEntry.version || 'unknown',
        })
      }
    }
  }

  return updates
}

/**
 * Reset the in-memory session state.
 * This should only be called at startup or for testing.
 */
export function resetInMemoryState(): void {
  inMemoryInstalledPlugins = null
}

/**
 * Initialize the versioned plugins system.
 * This triggers V1→V2 migration and initializes the in-memory session state.
 *
 * This should be called early during startup in all modes (REPL and headless).
 *
 * @returns Promise that resolves when initialization is complete
 */
export async function initializeVersionedPlugins(): Promise<void> {
  // Step 1: Migrate to single file format (consolidates V1/V2 files, cleans up legacy cache)
  migrateToSinglePluginFile()

  // Step 2: Sync enabledPlugins from settings.json to installed_plugins.json
  // This must complete before CLI exits (especially in headless mode)
  try {
    await migrateFromEnabledPlugins()
  } catch (error) {
    logError(error)
  }

  // Step 3: Initialize in-memory session state
  // Calling getInMemoryInstalledPlugins triggers:
  // 1. Loading from disk
  // 2. Caching in inMemoryInstalledPlugins for session state
  const data = getInMemoryInstalledPlugins()
  logForDebugging(
    `Initialized versioned plugins system with ${Object.keys(data.plugins).length} plugins`,
  )
}

/**
 * Remove all plugin entries belonging to a specific marketplace from installed_plugins.json.
 *
 * Loads V2 data once, finds all plugin IDs matching the `@{marketplaceName}` suffix,
 * collects their install paths, removes the entries, and saves once.
 *
 * @param marketplaceName - The marketplace name (matched against `@{name}` suffix)
 * @returns orphanedPaths (for markPluginVersionOrphaned) and removedPluginIds
 *   (for deletePluginOptions) from the removed entries
 */
export function removeAllPluginsForMarketplace(marketplaceName: string): {
  orphanedPaths: string[]
  removedPluginIds: string[]
} {
  if (!marketplaceName) {
    return { orphanedPaths: [], removedPluginIds: [] }
  }

  const data = loadInstalledPluginsFromDisk()
  const suffix = `@${marketplaceName}`
  const orphanedPaths = new Set<string>()
  const removedPluginIds: string[] = []

  for (const pluginId of Object.keys(data.plugins)) {
    if (!pluginId.endsWith(suffix)) {
      continue
    }

    for (const entry of data.plugins[pluginId] ?? []) {
      if (entry.installPath) {
        orphanedPaths.add(entry.installPath)
      }
    }

    delete data.plugins[pluginId]
    removedPluginIds.push(pluginId)
    logForDebugging(
      `Removed installed plugin for marketplace removal: ${pluginId}`,
    )
  }

  if (removedPluginIds.length > 0) {
    saveInstalledPluginsV2(data)
  }

  return { orphanedPaths: Array.from(orphanedPaths), removedPluginIds }
}

/**
 * Predicate: is this installation relevant to the current project context?
 *
 * V2 installed_plugins.json may contain project-scoped entries from OTHER
 * projects (a single user-level file tracks all scopes). Callers asking
 * "is this plugin installed" almost always mean "installed in a way that's
 * active here" — not "installed anywhere on this machine". See #29608:
 * DiscoverPlugins.tsx was hiding plugins that were only installed in an
 * unrelated project.
 *
 * - user/managed scopes: always relevant (global)
 * - project/local scopes: only if projectPath matches the current project
 *
 * getOriginalCwd() (not getCwd()) because "current project" is where Claude
 * Code was launched from, not wherever the working directory has drifted to.
 */
export function isInstallationRelevantToCurrentProject(
  inst: PluginInstallationEntry,
): boolean {
  return (
    inst.scope === 'user' ||
    inst.scope === 'managed' ||
    inst.projectPath === getOriginalCwd()
  )
}

/**
 * Check if a plugin is installed in a way relevant to the current project.
 *
 * @param pluginId - Plugin ID in "plugin@marketplace" format
 * @returns True if the plugin has a user/managed-scoped installation, OR a
 *   project/local-scoped installation whose projectPath matches the current
 *   project. Returns false for plugins only installed in other projects.
 */
export function isPluginInstalled(pluginId: string): boolean {
  const v2Data = loadInstalledPluginsV2()
  const installations = v2Data.plugins[pluginId]
  if (!installations || installations.length === 0) {
    return false
  }
  if (!installations.some(isInstallationRelevantToCurrentProject)) {
    return false
  }
  // Plugins are loaded from settings.enabledPlugins
  // If settings.enabledPlugins and installed_plugins.json diverge
  // (via settings.json clobber), return false
  return getSettings_DEPRECATED().enabledPlugins?.[pluginId] !== undefined
}

/**
 * True only if the plugin has a USER or MANAGED scope installation.
 *
 * Use this in UI flows that decide whether to offer installation at all.
 * A user/managed-scope install means the plugin is available everywhere —
 * there's nothing the user can add. A project/local-scope install means the
 * user might still want to install at user scope to make it global.
 *
 * gh-29997 / gh-29240 / gh-29392: the browse UI was blocking on
 * isPluginInstalled() which returns true for project-scope installs,
 * preventing users from adding a user-scope entry for the same plugin.
 * The backend (installPluginOp → addInstalledPlugin) already supports
 * multiple scope entries per plugin — only the UI gate was wrong.
 *
 * @param pluginId - Plugin ID in "plugin@marketplace" format
 */
export function isPluginGloballyInstalled(pluginId: string): boolean {
  const v2Data = loadInstalledPluginsV2()
  const installations = v2Data.plugins[pluginId]
  if (!installations || installations.length === 0) {
    return false
  }
  const hasGlobalEntry = installations.some(
    entry => entry.scope === 'user' || entry.scope === 'managed',
  )
  if (!hasGlobalEntry) return false
  // Same settings divergence guard as isPluginInstalled — if enabledPlugins
  // was clobbered, treat as not-installed so the user can re-enable.
  return getSettings_DEPRECATED().enabledPlugins?.[pluginId] !== undefined
}

/**
 * Add or update a plugin's installation metadata
 *
 * Implements double-write: updates both V1 and V2 files.
 *
 * @param pluginId - Plugin ID in "plugin@marketplace" format
 * @param metadata - Installation metadata
 * @param scope - Installation scope (defaults to 'user' for backward compatibility)
 * @param projectPath - Project path (for project/local scopes)
 */
export function addInstalledPlugin(
  pluginId: string,
  metadata: InstalledPlugin,
  scope: PersistableScope = 'user',
  projectPath?: string,
): void {
  const v2Data = loadInstalledPluginsFromDisk()
  const v2Entry: PluginInstallationEntry = {
    scope,
    installPath: metadata.installPath,
    version: metadata.version,
    installedAt: metadata.installedAt,
    lastUpdated: metadata.lastUpdated,
    gitCommitSha: metadata.gitCommitSha,
    ...(projectPath && { projectPath }),
  }

  // Get or create array for this plugin (preserves other scope installations)
  const installations = v2Data.plugins[pluginId] || []

  // Find existing entry for this scope+projectPath
  const existingIndex = installations.findIndex(
    entry => entry.scope === scope && entry.projectPath === projectPath,
  )

  const isUpdate = existingIndex >= 0
  if (isUpdate) {
    installations[existingIndex] = v2Entry
  } else {
    installations.push(v2Entry)
  }

  v2Data.plugins[pluginId] = installations
  saveInstalledPluginsV2(v2Data)

  logForDebugging(
    `${isUpdate ? 'Updated' : 'Added'} installed plugin: ${pluginId} (scope: ${scope})`,
  )
}

/**
 * Remove a plugin from the installed plugins registry
 * This should be called when a plugin is uninstalled.
 *
 * Note: This function only updates the registry file. To fully uninstall,
 * call deletePluginCache() afterward to remove the physical files.
 *
 * @param pluginId - Plugin ID in "plugin@marketplace" format
 * @returns The removed plugin metadata, or undefined if it wasn't installed
 */
export function removeInstalledPlugin(
  pluginId: string,
): InstalledPlugin | undefined {
  const v2Data = loadInstalledPluginsFromDisk()
  const installations = v2Data.plugins[pluginId]

  if (!installations || installations.length === 0) {
    return undefined
  }

  // Extract V1-compatible metadata from first installation for return value
  const firstInstall = installations[0]
  const metadata: InstalledPlugin | undefined = firstInstall
    ? {
        version: firstInstall.version || 'unknown',
        installedAt: firstInstall.installedAt || new Date().toISOString(),
        lastUpdated: firstInstall.lastUpdated,
        installPath: firstInstall.installPath,
        gitCommitSha: firstInstall.gitCommitSha,
      }
    : undefined

  delete v2Data.plugins[pluginId]
  saveInstalledPluginsV2(v2Data)

  logForDebugging(`Removed installed plugin: ${pluginId}`)

  return metadata
}

/**
 * Delete a plugin's cache directory
 * This physically removes the plugin files from disk
 *
 * @param installPath - Absolute path to the plugin's cache directory
 */
/**
 * Export getGitCommitSha for use by pluginInstallationHelpers
 */
export { getGitCommitSha }

export function deletePluginCache(installPath: string): void {
  const fs = getFsImplementation()

  try {
    fs.rmSync(installPath, { recursive: true, force: true })
    logForDebugging(`Deleted plugin cache at ${installPath}`)

    // Clean up empty parent plugin directory (cache/{marketplace}/{plugin})
    // Versioned paths have structure: cache/{marketplace}/{plugin}/{version}
    const cachePath = getPluginCachePath()
    if (installPath.includes('/cache/') && installPath.startsWith(cachePath)) {
      const pluginDir = dirname(installPath) // e.g., cache/{marketplace}/{plugin}
      if (pluginDir !== cachePath && pluginDir.startsWith(cachePath)) {
        try {
          const contents = fs.readdirSync(pluginDir)
          if (contents.length === 0) {
            fs.rmdirSync(pluginDir)
            logForDebugging(`Deleted empty plugin directory at ${pluginDir}`)
          }
        } catch {
          // Parent dir doesn't exist or isn't readable — skip cleanup
        }
      }
    }
  } catch (error) {
    const errorMsg = errorMessage(error)
    logError(toError(error))
    throw new Error(
      `Failed to delete plugin cache at ${installPath}: ${errorMsg}`,
    )
  }
}

/**
 * Get the git commit SHA from a git repository directory
 * Returns undefined if not a git repo or if operation fails
 */
async function getGitCommitSha(dirPath: string): Promise<string | undefined> {
  const sha = await getHeadForDir(dirPath)
  return sha ?? undefined
}

/**
 * Try to read version from plugin manifest
 */
function getPluginVersionFromManifest(
  pluginCachePath: string,
  pluginId: string,
): string {
  const fs = getFsImplementation()
  const manifestPath = join(pluginCachePath, '.claude-plugin', 'plugin.json')

  try {
    const manifestContent = fs.readFileSync(manifestPath, { encoding: 'utf-8' })
    const manifest = jsonParse(manifestContent)
    return manifest.version || 'unknown'
  } catch {
    logForDebugging(`Could not read version from manifest for ${pluginId}`)
    return 'unknown'
  }
}

/**
 * Sync installed_plugins.json with enabledPlugins from settings
 *
 * Checks the schema version and only updates if:
 * - File doesn't exist (version 0 → current)
 * - Schema version is outdated (old version → current)
 * - New plugins appear in enabledPlugins
 *
 * This version-based approach makes it easy to add new fields in the future:
 * 1. Increment CURRENT_SCHEMA_VERSION
 * 2. Add migration logic for the new version
 * 3. File is automatically updated on next startup
 *
 * For each plugin in enabledPlugins that's not in installed_plugins.json:
 * - Queries marketplace to get actual install path
 * - Extracts version from manifest if available
 * - Captures git commit SHA for git-based plugins
 *
 * Being present in enabledPlugins (whether true or false) indicates the plugin
 * has been installed. The enabled/disabled state remains in settings.json.
 */
export async function migrateFromEnabledPlugins(): Promise<void> {
  // Use merged settings for shouldSkipSync check
  const settings = getSettings_DEPRECATED()
  const enabledPlugins = settings.enabledPlugins || {}

  // No plugins in settings = nothing to sync
  if (Object.keys(enabledPlugins).length === 0) {
    return
  }

  // Check if main file exists and has V2 format
  const rawFileData = readInstalledPluginsFileRaw()
  const fileExists = rawFileData !== null
  const isV2Format = fileExists && rawFileData?.version === 2

  // If file exists with V2 format, check if we can skip the expensive migration
  if (isV2Format && rawFileData) {
    // Check if all plugins from settings already exist
    // (The expensive getPluginById/getGitCommitSha only runs for missing plugins)
    const existingData = InstalledPluginsFileSchemaV2().safeParse(
      rawFileData.data,
    )

    if (existingData?.success) {
      const plugins = existingData.data.plugins
      const allPluginsExist = Object.keys(enabledPlugins)
        .filter(id => id.includes('@'))
        .every(id => {
          const installations = plugins[id]
          return installations && installations.length > 0
        })

      if (allPluginsExist) {
        logForDebugging('All plugins already exist, skipping migration')
        return
      }
    }
  }

  logForDebugging(
    fileExists
      ? 'Syncing installed_plugins.json with enabledPlugins from all settings.json files'
      : 'Creating installed_plugins.json from settings.json files',
  )

  const now = new Date().toISOString()
  const projectPath = getCwd()

  // Step 1: Build a map of pluginId -> scope from all settings.json files
  // Settings.json is the source of truth for scope
  const pluginScopeFromSettings = new Map<
    string,
    {
      scope: 'user' | 'project' | 'local'
      projectPath: string | undefined
    }
  >()

  // Iterate through each editable settings source (order matters: user first)
  const settingSources: EditableSettingSource[] = [
    'userSettings',
    'projectSettings',
    'localSettings',
  ]

  for (const source of settingSources) {
    const sourceSettings = getSettingsForSource(source)
    const sourceEnabledPlugins = sourceSettings?.enabledPlugins || {}

    for (const pluginId of Object.keys(sourceEnabledPlugins)) {
      // Skip non-standard plugin IDs
      if (!pluginId.includes('@')) continue

      // Settings.json is source of truth - always update scope
      // Use the most specific scope (last one wins: local > project > user)
      const scope = settingSourceToScope(source)
      pluginScopeFromSettings.set(pluginId, {
        scope,
        projectPath: scope === 'user' ? undefined : projectPath,
      })
    }
  }

  // Step 2: Start with existing data (or start empty if no file exists)
  let v2Plugins: InstalledPluginsMapV2 = {}

  if (fileExists) {
    // File exists - load existing data
    const existingData = loadInstalledPluginsV2()
    v2Plugins = { ...existingData.plugins }
  }

  // Step 3: Update V2 scopes based on settings.json (settings is source of truth)
  let updatedCount = 0
  let addedCount = 0

  for (const [pluginId, scopeInfo] of pluginScopeFromSettings) {
    const existingInstallations = v2Plugins[pluginId]

    if (existingInstallations && existingInstallations.length > 0) {
      // Plugin exists in V2 - update scope if different (settings is source of truth)
      const existingEntry = existingInstallations[0]
      if (
        existingEntry &&
        (existingEntry.scope !== scopeInfo.scope ||
          existingEntry.projectPath !== scopeInfo.projectPath)
      ) {
        existingEntry.scope = scopeInfo.scope
        if (scopeInfo.projectPath) {
          existingEntry.projectPath = scopeInfo.projectPath
        } else {
          delete existingEntry.projectPath
        }
        existingEntry.lastUpdated = now
        updatedCount++
        logForDebugging(
          `Updated ${pluginId} scope to ${scopeInfo.scope} (settings.json is source of truth)`,
        )
      }
    } else {
      // Plugin not in V2 - try to add it by looking up in marketplace
      const { name: pluginName, marketplace } = parsePluginIdentifier(pluginId)

      if (!pluginName || !marketplace) {
        continue
      }

      try {
        logForDebugging(
          `Looking up plugin ${pluginId} in marketplace ${marketplace}`,
        )
        const pluginInfo = await getPluginById(pluginId)
        if (!pluginInfo) {
          logForDebugging(
            `Plugin ${pluginId} not found in any marketplace, skipping`,
          )
          continue
        }

        const { entry, marketplaceInstallLocation } = pluginInfo

        let installPath: string
        let version = 'unknown'
        let gitCommitSha: string | undefined = undefined

        if (typeof entry.source === 'string') {
          installPath = join(marketplaceInstallLocation, entry.source)
          version = getPluginVersionFromManifest(installPath, pluginId)
          gitCommitSha = await getGitCommitSha(installPath)
        } else {
          const cachePath = getPluginCachePath()
          const sanitizedName = pluginName.replace(/[^a-zA-Z0-9-_]/g, '-')
          const pluginCachePath = join(cachePath, sanitizedName)

          // Read the cache directory directly — readdir is the first real
          // operation, not a pre-check. Its ENOENT tells us the cache
          // doesn't exist; its result gates the manifest read below.
          // Not a TOCTOU — downstream operations handle ENOENT gracefully,
          // so a race (dir removed between readdir and read) degrades to
          // version='unknown', not a crash.
          let dirEntries: string[]
          try {
            dirEntries = (
              await getFsImplementation().readdir(pluginCachePath)
            ).map(e => (typeof e === 'string' ? e : e.name))
          } catch (e) {
            if (!isENOENT(e)) throw e
            logForDebugging(
              `External plugin ${pluginId} not in cache, skipping`,
            )
            continue
          }

          installPath = pluginCachePath

          // Only read manifest if the .claude-plugin dir is present
          if (dirEntries.includes('.claude-plugin')) {
            version = getPluginVersionFromManifest(pluginCachePath, pluginId)
          }

          gitCommitSha = await getGitCommitSha(pluginCachePath)
        }

        if (version === 'unknown' && entry.version) {
          version = entry.version
        }
        if (version === 'unknown' && gitCommitSha) {
          version = gitCommitSha.substring(0, 12)
        }

        v2Plugins[pluginId] = [
          {
            scope: scopeInfo.scope,
            installPath: getVersionedCachePath(pluginId, version),
            version,
            installedAt: now,
            lastUpdated: now,
            gitCommitSha,
            ...(scopeInfo.projectPath && {
              projectPath: scopeInfo.projectPath,
            }),
          },
        ]

        addedCount++
        logForDebugging(`Added ${pluginId} with scope ${scopeInfo.scope}`)
      } catch (error) {
        logForDebugging(`Failed to add plugin ${pluginId}: ${error}`)
      }
    }
  }

  // Step 4: Save to single file (V2 format)
  if (!fileExists || updatedCount > 0 || addedCount > 0) {
    const v2Data: InstalledPluginsFileV2 = { version: 2, plugins: v2Plugins }
    saveInstalledPluginsV2(v2Data)
    logForDebugging(
      `Sync completed: ${addedCount} added, ${updatedCount} updated in installed_plugins.json`,
    )
  }
}
