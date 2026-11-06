import { join } from 'path'
import { getCwd } from '../cwd.js'
import { logForDebugging } from '../debug.js'
import { logError } from '../log.js'
import type { SettingSource } from '../settings/constants.js'
import {
  getInitialSettings,
  getSettingsForSource,
  updateSettingsForSource,
} from '../settings/settings.js'
import { getAddDirEnabledPlugins } from './addDirPluginSettings.js'
import {
  getInMemoryInstalledPlugins,
  migrateFromEnabledPlugins,
} from './installedPluginsManager.js'
import { getPluginById } from './marketplaceManager.js'
import {
  type ExtendedPluginScope,
  type PersistablePluginScope,
  SETTING_SOURCE_TO_SCOPE,
  scopeToSettingSource,
} from './pluginIdentifier.js'
import {
  cacheAndRegisterPlugin,
  registerPluginInstallation,
} from './pluginInstallationHelpers.js'
import { isLocalPluginSource, type PluginScope } from './schemas.js'

/**
 * Checks for enabled plugins across all settings sources, including --add-dir.
 *
 * Uses getInitialSettings() which merges all sources with policy as
 * highest priority, then layers --add-dir plugins underneath. This is the
 * authoritative "is this plugin enabled?" check — don't delegate to
 * getPluginEditableScopes() which serves a different purpose (scope tracking).
 *
 * @returns Array of plugin IDs (plugin@marketplace format) that are enabled
 */
export async function checkEnabledPlugins(): Promise<string[]> {
  const settings = getInitialSettings()
  const enabledPlugins: string[] = []

  // Start with --add-dir plugins (lowest priority)
  const addDirPlugins = getAddDirEnabledPlugins()
  for (const [pluginId, value] of Object.entries(addDirPlugins)) {
    if (pluginId.includes('@') && value) {
      enabledPlugins.push(pluginId)
    }
  }

  // Merged settings (policy > local > project > user) override --add-dir
  if (settings.enabledPlugins) {
    for (const [pluginId, value] of Object.entries(settings.enabledPlugins)) {
      if (!pluginId.includes('@')) {
        continue
      }
      const idx = enabledPlugins.indexOf(pluginId)
      if (value) {
        if (idx === -1) {
          enabledPlugins.push(pluginId)
        }
      } else {
        // Explicitly disabled — remove even if --add-dir enabled it
        if (idx !== -1) {
          enabledPlugins.splice(idx, 1)
        }
      }
    }
  }

  return enabledPlugins
}

/**
 * Gets the user-editable scope that "owns" each enabled plugin.
 *
 * Used for scope tracking: determining where to write back when a user
 * enables/disables a plugin. Managed (policy) settings are processed first
 * (lowest priority) because the user cannot edit them — the scope should
 * resolve to the highest user-controllable source.
 *
 * NOTE: This is NOT the authoritative "is this plugin enabled?" check.
 * Use checkEnabledPlugins() for that — it uses merged settings where
 * policy has highest priority and can block user-enabled plugins.
 *
 * Precedence (lowest to highest):
 * 0. addDir (--add-dir directories) - session-only, lowest priority
 * 1. managed (policySettings) - not user-editable
 * 2. user (userSettings)
 * 3. project (projectSettings)
 * 4. local (localSettings)
 * 5. flag (flagSettings) - session-only, not persisted
 *
 * @returns Map of plugin ID to the user-editable scope that owns it
 */
export function getPluginEditableScopes(): Map<string, ExtendedPluginScope> {
  const result = new Map<string, ExtendedPluginScope>()

  // Process --add-dir directories FIRST (lowest priority, overridden by all standard sources)
  const addDirPlugins = getAddDirEnabledPlugins()
  for (const [pluginId, value] of Object.entries(addDirPlugins)) {
    if (!pluginId.includes('@')) {
      continue
    }
    if (value === true) {
      result.set(pluginId, 'flag') // 'flag' scope = session-only, no write-back
    } else if (value === false) {
      result.delete(pluginId)
    }
  }

  // Process standard sources in precedence order (later overrides earlier)
  const scopeSources: Array<{
    scope: ExtendedPluginScope
    source: SettingSource
  }> = [
    { scope: 'managed', source: 'policySettings' },
    { scope: 'user', source: 'userSettings' },
    { scope: 'project', source: 'projectSettings' },
    { scope: 'local', source: 'localSettings' },
    { scope: 'flag', source: 'flagSettings' },
  ]

  for (const { scope, source } of scopeSources) {
    const settings = getSettingsForSource(source)
    if (!settings?.enabledPlugins) {
      continue
    }

    for (const [pluginId, value] of Object.entries(settings.enabledPlugins)) {
      // Skip invalid format
      if (!pluginId.includes('@')) {
        continue
      }

      // Log when a standard source overrides an --add-dir plugin
      if (pluginId in addDirPlugins && addDirPlugins[pluginId] !== value) {
        logForDebugging(
          `Plugin ${pluginId} from --add-dir (${addDirPlugins[pluginId]}) overridden by ${source} (${value})`,
        )
      }

      if (value === true) {
        // Plugin enabled at this scope
        result.set(pluginId, scope)
      } else if (value === false) {
        // Explicitly disabled - remove from result
        result.delete(pluginId)
      }
      // Note: Other values (like version strings for future P2) are ignored for now
    }
  }

  logForDebugging(
    `Found ${result.size} enabled plugins with scopes: ${Array.from(
      result.entries(),
    )
      .map(([id, scope]) => `${id}(${scope})`)
      .join(', ')}`,
  )

  return result
}

/**
 * Check if a scope is persistable (not session-only).
 * @param scope The scope to check
 * @returns true if the scope should be persisted to installed_plugins.json
 */
export function isPersistableScope(
  scope: ExtendedPluginScope,
): scope is PersistablePluginScope {
  return scope !== 'flag'
}

/**
 * Convert SettingSource to plugin scope.
 * @param source The settings source
 * @returns The corresponding plugin scope
 */
export function settingSourceToScope(
  source: SettingSource,
): ExtendedPluginScope {
  return SETTING_SOURCE_TO_SCOPE[source]
}

/**
 * Gets the list of currently installed plugins
 * Reads from installed_plugins.json which tracks global installation state.
 * Automatically runs migration on first call if needed.
 *
 * Always uses V2 format and initializes the in-memory session state
 * (which triggers V1→V2 migration if needed).
 *
 * @returns Array of installed plugin IDs
 */
export async function getInstalledPlugins(): Promise<string[]> {
  // Trigger sync in background (don't await - don't block startup)
  // This syncs enabledPlugins from settings.json to installed_plugins.json
  void migrateFromEnabledPlugins().catch(error => {
    logError(error)
  })

  // Always use V2 format - initializes in-memory session state and triggers V1→V2 migration
  const v2Data = getInMemoryInstalledPlugins()
  const installed = Object.keys(v2Data.plugins)
  logForDebugging(`Found ${installed.length} installed plugins`)
  return installed
}

/**
 * Finds plugins that are enabled but not installed
 * @param enabledPlugins Array of enabled plugin IDs
 * @returns Array of missing plugin IDs
 */
export async function findMissingPlugins(
  enabledPlugins: string[],
): Promise<string[]> {
  try {
    const installedPlugins = await getInstalledPlugins()

    // Filter to not-installed synchronously, then look up all in parallel.
    // Results are collected in original enabledPlugins order.
    const notInstalled = enabledPlugins.filter(
      id => !installedPlugins.includes(id),
    )
    const lookups = await Promise.all(
      notInstalled.map(async pluginId => {
        try {
          const plugin = await getPluginById(pluginId)
          return { pluginId, found: plugin !== null && plugin !== undefined }
        } catch (error) {
          logForDebugging(
            `Failed to check plugin ${pluginId} in marketplace: ${error}`,
          )
          // Plugin doesn't exist in any marketplace, will be handled as an error
          return { pluginId, found: false }
        }
      }),
    )
    const missing = lookups
      .filter(({ found }) => found)
      .map(({ pluginId }) => pluginId)

    return missing
  } catch (error) {
    logError(error)
    return []
  }
}

/**
 * Result of plugin installation attempt
 */
export type PluginInstallResult = {
  installed: string[]
  failed: Array<{ name: string; error: string }>
}

/**
 * Installation scope type for install functions (excludes 'managed' which is read-only)
 */
type InstallableScope = Exclude<PluginScope, 'managed'>

/**
 * Installs the selected plugins
 * @param pluginsToInstall Array of plugin IDs to install
 * @param onProgress Optional callback for installation progress
 * @param scope Installation scope: user, project, or local (defaults to 'user')
 * @returns Installation results with succeeded and failed plugins
 */
export async function installSelectedPlugins(
  pluginsToInstall: string[],
  onProgress?: (name: string, index: number, total: number) => void,
  scope: InstallableScope = 'user',
): Promise<PluginInstallResult> {
  // Get projectPath for non-user scopes
  const projectPath = scope !== 'user' ? getCwd() : undefined

  // Get the correct settings source for this scope
  const settingSource = scopeToSettingSource(scope)
  const settings = getSettingsForSource(settingSource)
  const updatedEnabledPlugins = { ...settings?.enabledPlugins }
  const installed: string[] = []
  const failed: Array<{ name: string; error: string }> = []

  for (let i = 0; i < pluginsToInstall.length; i++) {
    const pluginId = pluginsToInstall[i]
    if (!pluginId) continue

    if (onProgress) {
      onProgress(pluginId, i + 1, pluginsToInstall.length)
    }

    try {
      const pluginInfo = await getPluginById(pluginId)
      if (!pluginInfo) {
        failed.push({
          name: pluginId,
          error: 'Plugin not found in any marketplace',
        })
        continue
      }

      // Cache the plugin if it's from an external source
      const { entry, marketplaceInstallLocation } = pluginInfo
      if (!isLocalPluginSource(entry.source)) {
        // External plugin - cache and register it with scope
        await cacheAndRegisterPlugin(pluginId, entry, scope, projectPath)
      } else {
        // Local plugin - just register it with the install path and scope
        registerPluginInstallation(
          {
            pluginId,
            installPath: join(marketplaceInstallLocation, entry.source),
            version: entry.version,
          },
          scope,
          projectPath,
        )
      }

      // Mark as enabled in settings
      updatedEnabledPlugins[pluginId] = true
      installed.push(pluginId)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      failed.push({ name: pluginId, error: errorMessage })
      logError(error)
    }
  }

  // Update settings with newly enabled plugins using the correct settings source
  updateSettingsForSource(settingSource, {
    ...settings,
    enabledPlugins: updatedEnabledPlugins,
  })

  return { installed, failed }
}
