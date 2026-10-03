/**
 * Zip Cache Adapters
 *
 * I/O helpers for the plugin zip cache. These functions handle reading/writing
 * zip-cache-local metadata files, extracting ZIPs to session directories,
 * and creating ZIPs for newly installed plugins.
 *
 * The zip cache stores data on a mounted volume (e.g., Filestore) that persists
 * across ephemeral container lifetimes. The session cache is a local temp dir
 * for extracted plugins used during a single session.
 */

import { readFile } from 'fs/promises'
import { join } from 'path'
import { logForDebugging } from '../debug.js'
import { jsonParse, jsonStringify } from '../slowOperations.js'
import { loadKnownMarketplacesConfigSafe } from './marketplaceManager.js'
import {
  type KnownMarketplacesFile,
  KnownMarketplacesFileSchema,
  type PluginMarketplace,
  PluginMarketplaceSchema,
} from './schemas.js'
import {
  atomicWriteToZipCache,
  getMarketplaceJsonRelativePath,
  getPluginZipCachePath,
  getZipCacheKnownMarketplacesPath,
} from './zipCache.js'

// ── Metadata I/O ──

/**
 * Read known_marketplaces.json from the zip cache.
 * Returns empty object if file doesn't exist, can't be parsed, or fails schema
 * validation (data comes from a shared mounted volume — other containers may write).
 */
export async function readZipCacheKnownMarketplaces(): Promise<KnownMarketplacesFile> {
  try {
    const content = await readFile(getZipCacheKnownMarketplacesPath(), 'utf-8')
    const parsed = KnownMarketplacesFileSchema().safeParse(jsonParse(content))
    if (!parsed.success) {
      logForDebugging(
        `Invalid known_marketplaces.json in zip cache: ${parsed.error.message}`,
        { level: 'error' },
      )
      return {}
    }
    return parsed.data
  } catch {
    return {}
  }
}

/**
 * Write known_marketplaces.json to the zip cache atomically.
 */
export async function writeZipCacheKnownMarketplaces(
  data: KnownMarketplacesFile,
): Promise<void> {
  await atomicWriteToZipCache(
    getZipCacheKnownMarketplacesPath(),
    jsonStringify(data, null, 2),
  )
}

// ── Marketplace JSON ──

/**
 * Read a marketplace JSON file from the zip cache.
 */
export async function readMarketplaceJson(
  marketplaceName: string,
): Promise<PluginMarketplace | null> {
  const zipCachePath = getPluginZipCachePath()
  if (!zipCachePath) {
    return null
  }
  const relPath = getMarketplaceJsonRelativePath(marketplaceName)
  const fullPath = join(zipCachePath, relPath)
  try {
    const content = await readFile(fullPath, 'utf-8')
    const parsed = jsonParse(content)
    const result = PluginMarketplaceSchema().safeParse(parsed)
    if (result.success) {
      return result.data
    }
    logForDebugging(
      `Invalid marketplace JSON for ${marketplaceName}: ${result.error}`,
    )
    return null
  } catch {
    return null
  }
}

/**
 * Save a marketplace JSON to the zip cache from its install location.
 */
export async function saveMarketplaceJsonToZipCache(
  marketplaceName: string,
  installLocation: string,
): Promise<void> {
  const zipCachePath = getPluginZipCachePath()
  if (!zipCachePath) {
    return
  }
  const content = await readMarketplaceJsonContent(installLocation)
  if (content !== null) {
    const relPath = getMarketplaceJsonRelativePath(marketplaceName)
    await atomicWriteToZipCache(join(zipCachePath, relPath), content)
  }
}

/**
 * Read marketplace.json content from a cloned marketplace directory or file.
 * For directory sources: checks .claude-plugin/marketplace.json, marketplace.json
 * For URL sources: the installLocation IS the marketplace JSON file itself.
 */
async function readMarketplaceJsonContent(dir: string): Promise<string | null> {
  const candidates = [
    join(dir, '.claude-plugin', 'marketplace.json'),
    join(dir, 'marketplace.json'),
    dir, // For URL sources, installLocation IS the marketplace JSON file
  ]
  for (const candidate of candidates) {
    try {
      return await readFile(candidate, 'utf-8')
    } catch {
      // ENOENT (doesn't exist) or EISDIR (directory) — try next
    }
  }
  return null
}

/**
 * Sync marketplace data to zip cache for offline access.
 * Saves marketplace JSONs and merges with previously cached data
 * so ephemeral containers can access marketplaces without re-cloning.
 */
export async function syncMarketplacesToZipCache(): Promise<void> {
  // Read-only iteration — Safe variant so a corrupted config doesn't throw.
  // This runs during startup paths; a throw here cascades to the same
  // try-block that catches loadAllPlugins failures.
  const knownMarketplaces = await loadKnownMarketplacesConfigSafe()

  // Save marketplace JSONs to zip cache
  for (const [name, entry] of Object.entries(knownMarketplaces)) {
    if (!entry.installLocation) continue
    try {
      await saveMarketplaceJsonToZipCache(name, entry.installLocation)
    } catch (error) {
      logForDebugging(`Failed to save marketplace JSON for ${name}: ${error}`)
    }
  }

  // Merge with previously cached data (ephemeral containers lose global config)
  const zipCacheKnownMarketplaces = await readZipCacheKnownMarketplaces()
  const mergedKnownMarketplaces: KnownMarketplacesFile = {
    ...zipCacheKnownMarketplaces,
    ...knownMarketplaces,
  }
  await writeZipCacheKnownMarketplaces(mergedKnownMarketplaces)
}
