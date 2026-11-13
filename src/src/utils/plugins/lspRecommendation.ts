/**
 * LSP Plugin Recommendation Utility
 *
 * Scans installed marketplaces for LSP plugins and recommends plugins
 * based on file extensions, but ONLY when the LSP binary is already
 * installed on the system.
 *
 * Limitation: Can only detect LSP plugins that declare their servers
 * inline in the marketplace entry. Plugins with separate .lsp.json files
 * are not detectable until after installation.
 */

import { extname } from 'path'
import { isBinaryInstalled } from '../binaryCheck.js'
import { getGlobalConfig, saveGlobalConfig } from '../config.js'
import { logForDebugging } from '../debug.js'
import { isPluginInstalled } from './installedPluginsManager.js'
import {
  getMarketplace,
  loadKnownMarketplacesConfig,
} from './marketplaceManager.js'
import {
  ALLOWED_OFFICIAL_MARKETPLACE_NAMES,
  type PluginMarketplaceEntry,
} from './schemas.js'

/**
 * LSP plugin recommendation returned to the caller
 */
export type LspPluginRecommendation = {
  pluginId: string // "plugin-name@marketplace-name"
  pluginName: string // Human-readable plugin name
  marketplaceName: string // Marketplace name
  description?: string // Plugin description
  isOfficial: boolean // From official marketplace?
  extensions: string[] // File extensions this plugin supports
  command: string // LSP server command (e.g., "typescript-language-server")
}

// Maximum number of times user can ignore recommendations before we stop showing
const MAX_IGNORED_COUNT = 5

/**
 * Check if a marketplace is official (from Anthropic)
 */
function isOfficialMarketplace(name: string): boolean {
  return ALLOWED_OFFICIAL_MARKETPLACE_NAMES.has(name.toLowerCase())
}

/**
 * Internal type for LSP info extracted from plugin manifest
 */
type LspInfo = {
  extensions: Set<string>
  command: string
}

/**
 * Extract LSP info (extensions and command) from inline lspServers config.
 *
 * NOTE: Can only read inline configs, not external .lsp.json files.
 * String paths are skipped as they reference files only available after installation.
 *
 * @param lspServers - The lspServers field from PluginMarketplaceEntry
 * @returns LSP info with extensions and command, or null if not extractable
 */
function extractLspInfoFromManifest(
  lspServers: PluginMarketplaceEntry['lspServers'],
): LspInfo | null {
  if (!lspServers) {
    return null
  }

  // If it's a string path (e.g., "./.lsp.json"), we can't read it from marketplace
  if (typeof lspServers === 'string') {
    logForDebugging(
      '[lspRecommendation] Skipping string path lspServers (not readable from marketplace)',
    )
    return null
  }

  // If it's an array, process each element
  if (Array.isArray(lspServers)) {
    for (const item of lspServers) {
      // Skip string paths in arrays
      if (typeof item === 'string') {
        continue
      }
      // Try to extract from inline config object
      const info = extractFromServerConfigRecord(item)
      if (info) {
        return info
      }
    }
    return null
  }

  // It's an inline config object: Record<string, LspServerConfig>
  return extractFromServerConfigRecord(lspServers)
}

/**
 * Extract LSP info from a server config record (inline object format)
 */
/**
 * Type guard to check if a value is a record object
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function extractFromServerConfigRecord(
  serverConfigs: Record<string, unknown>,
): LspInfo | null {
  const extensions = new Set<string>()
  let command: string | null = null

  for (const [_serverName, config] of Object.entries(serverConfigs)) {
    if (!isRecord(config)) {
      continue
    }

    // Get command from first valid server config
    if (!command && typeof config.command === 'string') {
      command = config.command
    }

    // Collect all extensions from extensionToLanguage mapping
    const extMapping = config.extensionToLanguage
    if (isRecord(extMapping)) {
      for (const ext of Object.keys(extMapping)) {
        extensions.add(ext.toLowerCase())
      }
    }
  }

  if (!command || extensions.size === 0) {
    return null
  }

  return { extensions, command }
}

/**
 * Internal type for plugin with LSP info
 */
type LspPluginInfo = {
  entry: PluginMarketplaceEntry
  marketplaceName: string
  extensions: Set<string>
  command: string
  isOfficial: boolean
}

/**
 * Get all LSP plugins from all installed marketplaces
 *
 * @returns Map of pluginId to plugin info with LSP metadata
 */
async function getLspPluginsFromMarketplaces(): Promise<
  Map<string, LspPluginInfo>
> {
  const result = new Map<string, LspPluginInfo>()

  try {
    const config = await loadKnownMarketplacesConfig()

    for (const marketplaceName of Object.keys(config)) {
      try {
        const marketplace = await getMarketplace(marketplaceName)
        const isOfficial = isOfficialMarketplace(marketplaceName)

        for (const entry of marketplace.plugins) {
          // Skip plugins without lspServers
          if (!entry.lspServers) {
            continue
          }

          const lspInfo = extractLspInfoFromManifest(entry.lspServers)
          if (!lspInfo) {
            continue
          }

          const pluginId = `${entry.name}@${marketplaceName}`
          result.set(pluginId, {
            entry,
            marketplaceName,
            extensions: lspInfo.extensions,
            command: lspInfo.command,
            isOfficial,
          })
        }
      } catch (error) {
        logForDebugging(
          `[lspRecommendation] Failed to load marketplace ${marketplaceName}: ${error}`,
        )
      }
    }
  } catch (error) {
    logForDebugging(
      `[lspRecommendation] Failed to load marketplaces config: ${error}`,
    )
  }

  return result
}

/**
 * Find matching LSP plugins for a file path.
 *
 * Returns recommendations for plugins that:
 * 1. Support the file's extension
 * 2. Have their LSP binary installed on the system
 * 3. Are not already installed
 * 4. Are not in the user's "never suggest" list
 *
 * Results are sorted with official marketplace plugins first.
 *
 * @param filePath - Path to the file to find LSP plugins for
 * @returns Array of matching plugin recommendations (empty if none or disabled)
 */
export async function getMatchingLspPlugins(
  filePath: string,
): Promise<LspPluginRecommendation[]> {
  // Check if globally disabled
  if (isLspRecommendationsDisabled()) {
    logForDebugging('[lspRecommendation] Recommendations are disabled')
    return []
  }

  // Extract file extension
  const ext = extname(filePath).toLowerCase()
  if (!ext) {
    logForDebugging('[lspRecommendation] No file extension found')
    return []
  }

  logForDebugging(`[lspRecommendation] Looking for LSP plugins for ${ext}`)

  // Get all LSP plugins from marketplaces
  const allLspPlugins = await getLspPluginsFromMarketplaces()

  // Get config for filtering
  const config = getGlobalConfig()
  const neverPlugins = config.lspRecommendationNeverPlugins ?? []

  // Filter to matching plugins
  const matchingPlugins: Array<{ info: LspPluginInfo; pluginId: string }> = []

  for (const [pluginId, info] of allLspPlugins) {
    // Check extension match
    if (!info.extensions.has(ext)) {
      continue
    }

    // Filter: not in "never" list
    if (neverPlugins.includes(pluginId)) {
      logForDebugging(
        `[lspRecommendation] Skipping ${pluginId} (in never suggest list)`,
      )
      continue
    }

    // Filter: not already installed
    if (isPluginInstalled(pluginId)) {
      logForDebugging(
        `[lspRecommendation] Skipping ${pluginId} (already installed)`,
      )
      continue
    }

    matchingPlugins.push({ info, pluginId })
  }

  // Filter: binary must be installed (async check)
  const pluginsWithBinary: Array<{ info: LspPluginInfo; pluginId: string }> = []

  for (const { info, pluginId } of matchingPlugins) {
    const binaryExists = await isBinaryInstalled(info.command)
    if (binaryExists) {
      pluginsWithBinary.push({ info, pluginId })
      logForDebugging(
        `[lspRecommendation] Binary '${info.command}' found for ${pluginId}`,
      )
    } else {
      logForDebugging(
        `[lspRecommendation] Skipping ${pluginId} (binary '${info.command}' not found)`,
      )
    }
  }

  // Sort: official marketplaces first
  pluginsWithBinary.sort((a, b) => {
    if (a.info.isOfficial && !b.info.isOfficial) return -1
    if (!a.info.isOfficial && b.info.isOfficial) return 1
    return 0
  })

  // Convert to recommendations
  return pluginsWithBinary.map(({ info, pluginId }) => ({
    pluginId,
    pluginName: info.entry.name,
    marketplaceName: info.marketplaceName,
    description: info.entry.description,
    isOfficial: info.isOfficial,
    extensions: Array.from(info.extensions),
    command: info.command,
  }))
}

/**
 * Add a plugin to the "never suggest" list
 *
 * @param pluginId - Plugin ID to never suggest again
 */
export function addToNeverSuggest(pluginId: string): void {
  saveGlobalConfig(currentConfig => {
    const current = currentConfig.lspRecommendationNeverPlugins ?? []
    if (current.includes(pluginId)) {
      return currentConfig
    }
    return {
      ...currentConfig,
      lspRecommendationNeverPlugins: [...current, pluginId],
    }
  })
  logForDebugging(`[lspRecommendation] Added ${pluginId} to never suggest`)
}

/**
 * Increment the ignored recommendation count.
 * After MAX_IGNORED_COUNT ignores, recommendations are disabled.
 */
export function incrementIgnoredCount(): void {
  saveGlobalConfig(currentConfig => {
    const newCount = (currentConfig.lspRecommendationIgnoredCount ?? 0) + 1
    return {
      ...currentConfig,
      lspRecommendationIgnoredCount: newCount,
    }
  })
  logForDebugging('[lspRecommendation] Incremented ignored count')
}

/**
 * Check if LSP recommendations are disabled.
 * Disabled when:
 * - User explicitly disabled via config
 * - User has ignored MAX_IGNORED_COUNT recommendations
 */
export function isLspRecommendationsDisabled(): boolean {
  const config = getGlobalConfig()
  return (
    config.lspRecommendationDisabled === true ||
    (config.lspRecommendationIgnoredCount ?? 0) >= MAX_IGNORED_COUNT
  )
}

/**
 * Reset the ignored count (useful if user re-enables recommendations)
 */
export function resetIgnoredCount(): void {
  saveGlobalConfig(currentConfig => {
    const currentCount = currentConfig.lspRecommendationIgnoredCount ?? 0
    if (currentCount === 0) {
      return currentConfig
    }
    return {
      ...currentConfig,
      lspRecommendationIgnoredCount: 0,
    }
  })
  logForDebugging('[lspRecommendation] Reset ignored count')
}
