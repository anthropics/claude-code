/**
 * Plugin install counts data layer
 *
 * This module fetches and caches plugin install counts from the official
 * Claude plugins statistics repository. The cache is refreshed if older
 * than 24 hours.
 *
 * Cache location: ~/.claude/plugins/install-counts-cache.json
 */

import axios from 'axios'
import { randomBytes } from 'crypto'
import { readFile, rename, unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import { logForDebugging } from '../debug.js'
import { errorMessage, getErrnoCode } from '../errors.js'
import { getFsImplementation } from '../fsOperations.js'
import { logError } from '../log.js'
import { jsonParse, jsonStringify } from '../slowOperations.js'
import { classifyFetchError, logPluginFetch } from './fetchTelemetry.js'
import { getPluginsDirectory } from './pluginDirectories.js'

const INSTALL_COUNTS_CACHE_VERSION = 1
const INSTALL_COUNTS_CACHE_FILENAME = 'install-counts-cache.json'
const INSTALL_COUNTS_URL =
  'https://raw.githubusercontent.com/anthropics/claude-plugins-official/refs/heads/stats/stats/plugin-installs.json'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

/**
 * Structure of the install counts cache file
 */
type InstallCountsCache = {
  version: number
  fetchedAt: string // ISO timestamp
  counts: Array<{
    plugin: string // "pluginName@marketplace"
    unique_installs: number
  }>
}

/**
 * Expected structure of the GitHub stats response
 */
type GitHubStatsResponse = {
  plugins: Array<{
    plugin: string
    unique_installs: number
  }>
}

/**
 * Get the path to the install counts cache file
 */
function getInstallCountsCachePath(): string {
  return join(getPluginsDirectory(), INSTALL_COUNTS_CACHE_FILENAME)
}

/**
 * Load the install counts cache from disk.
 * Returns null if the file doesn't exist, is invalid, or is stale (>24h old).
 */
async function loadInstallCountsCache(): Promise<InstallCountsCache | null> {
  const cachePath = getInstallCountsCachePath()

  try {
    const content = await readFile(cachePath, { encoding: 'utf-8' })
    const parsed = jsonParse(content) as unknown

    // Validate basic structure
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('version' in parsed) ||
      !('fetchedAt' in parsed) ||
      !('counts' in parsed)
    ) {
      logForDebugging('Install counts cache has invalid structure')
      return null
    }

    const cache = parsed as {
      version: unknown
      fetchedAt: unknown
      counts: unknown
    }

    // Validate version
    if (cache.version !== INSTALL_COUNTS_CACHE_VERSION) {
      logForDebugging(
        `Install counts cache version mismatch (got ${cache.version}, expected ${INSTALL_COUNTS_CACHE_VERSION})`,
      )
      return null
    }

    // Validate fetchedAt and counts
    if (typeof cache.fetchedAt !== 'string' || !Array.isArray(cache.counts)) {
      logForDebugging('Install counts cache has invalid structure')
      return null
    }

    // Validate fetchedAt is a valid date
    const fetchedAt = new Date(cache.fetchedAt).getTime()
    if (Number.isNaN(fetchedAt)) {
      logForDebugging('Install counts cache has invalid fetchedAt timestamp')
      return null
    }

    // Validate count entries have required fields
    const validCounts = cache.counts.every(
      (entry): entry is { plugin: string; unique_installs: number } =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof entry.plugin === 'string' &&
        typeof entry.unique_installs === 'number',
    )
    if (!validCounts) {
      logForDebugging('Install counts cache has malformed entries')
      return null
    }

    // Check if cache is stale (>24 hours old)
    const now = Date.now()
    if (now - fetchedAt > CACHE_TTL_MS) {
      logForDebugging('Install counts cache is stale (>24h old)')
      return null
    }

    // Return validated cache
    return {
      version: cache.version as number,
      fetchedAt: cache.fetchedAt,
      counts: cache.counts,
    }
  } catch (error) {
    const code = getErrnoCode(error)
    if (code !== 'ENOENT') {
      logForDebugging(
        `Failed to load install counts cache: ${errorMessage(error)}`,
      )
    }
    return null
  }
}

/**
 * Save the install counts cache to disk atomically.
 * Uses a temp file + rename pattern to prevent corruption.
 */
async function saveInstallCountsCache(
  cache: InstallCountsCache,
): Promise<void> {
  const cachePath = getInstallCountsCachePath()
  const tempPath = `${cachePath}.${randomBytes(8).toString('hex')}.tmp`

  try {
    // Ensure the plugins directory exists
    const pluginsDir = getPluginsDirectory()
    await getFsImplementation().mkdir(pluginsDir)

    // Write to temp file
    const content = jsonStringify(cache, null, 2)
    await writeFile(tempPath, content, {
      encoding: 'utf-8',
      mode: 0o600,
    })

    // Atomic rename
    await rename(tempPath, cachePath)
    logForDebugging('Install counts cache saved successfully')
  } catch (error) {
    logError(error)
    // Clean up temp file if it exists
    try {
      await unlink(tempPath)
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Fetch install counts from GitHub stats repository
 */
async function fetchInstallCountsFromGitHub(): Promise<
  Array<{ plugin: string; unique_installs: number }>
> {
  logForDebugging(`Fetching install counts from ${INSTALL_COUNTS_URL}`)

  const started = performance.now()
  try {
    const response = await axios.get<GitHubStatsResponse>(INSTALL_COUNTS_URL, {
      timeout: 10000,
    })

    if (!response.data?.plugins || !Array.isArray(response.data.plugins)) {
      throw new Error('Invalid response format from install counts API')
    }

    logPluginFetch(
      'install_counts',
      INSTALL_COUNTS_URL,
      'success',
      performance.now() - started,
    )
    return response.data.plugins
  } catch (error) {
    logPluginFetch(
      'install_counts',
      INSTALL_COUNTS_URL,
      'failure',
      performance.now() - started,
      classifyFetchError(error),
    )
    throw error
  }
}

/**
 * Get plugin install counts as a Map.
 * Uses cached data if available and less than 24 hours old.
 * Returns null on errors so UI can hide counts rather than show misleading zeros.
 *
 * @returns Map of plugin ID (name@marketplace) to install count, or null if unavailable
 */
export async function getInstallCounts(): Promise<Map<string, number> | null> {
  // Try to load from cache first
  const cache = await loadInstallCountsCache()
  if (cache) {
    logForDebugging('Using cached install counts')
    logPluginFetch('install_counts', INSTALL_COUNTS_URL, 'cache_hit', 0)
    const map = new Map<string, number>()
    for (const entry of cache.counts) {
      map.set(entry.plugin, entry.unique_installs)
    }
    return map
  }

  // Cache miss or stale - fetch from GitHub
  try {
    const counts = await fetchInstallCountsFromGitHub()

    // Save to cache
    const newCache: InstallCountsCache = {
      version: INSTALL_COUNTS_CACHE_VERSION,
      fetchedAt: new Date().toISOString(),
      counts,
    }
    await saveInstallCountsCache(newCache)

    // Convert to Map
    const map = new Map<string, number>()
    for (const entry of counts) {
      map.set(entry.plugin, entry.unique_installs)
    }
    return map
  } catch (error) {
    // Log error and return null so UI can hide counts
    logError(error)
    logForDebugging(`Failed to fetch install counts: ${errorMessage(error)}`)
    return null
  }
}

/**
 * Format an install count for display.
 *
 * @param count - The raw install count
 * @returns Formatted string:
 *   - <1000: raw number (e.g., "42")
 *   - >=1000: K suffix with 1 decimal (e.g., "1.2K", "36.2K")
 *   - >=1000000: M suffix with 1 decimal (e.g., "1.2M")
 */
export function formatInstallCount(count: number): string {
  if (count < 1000) {
    return String(count)
  }

  if (count < 1000000) {
    const k = count / 1000
    // Use toFixed(1) but remove trailing .0
    const formatted = k.toFixed(1)
    return formatted.endsWith('.0')
      ? `${formatted.slice(0, -2)}K`
      : `${formatted}K`
  }

  const m = count / 1000000
  const formatted = m.toFixed(1)
  return formatted.endsWith('.0')
    ? `${formatted.slice(0, -2)}M`
    : `${formatted}M`
}
