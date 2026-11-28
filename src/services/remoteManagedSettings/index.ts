/**
 * Remote Managed Settings Service
 *
 * Manages fetching, caching, and validation of remote-managed settings
 * for enterprise customers. Uses checksum-based validation to minimize
 * network traffic and provides graceful degradation on failures.
 *
 * Eligibility:
 * - Console users (API key): All eligible
 * - OAuth users (Claude.ai): Only Enterprise/C4E and Team subscribers are eligible
 * - API fails open (non-blocking) - if fetch fails, continues without remote settings
 * - API returns empty settings for users without managed settings
 */

import axios from 'axios'
import { createHash } from 'crypto'
import { open, unlink } from 'fs/promises'
import { getOauthConfig, OAUTH_BETA_HEADER } from '../../constants/oauth.js'
import {
  checkAndRefreshOAuthTokenIfNeeded,
  getAnthropicApiKeyWithSource,
  getClaudeAIOAuthTokens,
} from '../../utils/auth.js'
import { registerCleanup } from '../../utils/cleanupRegistry.js'
import { logForDebugging } from '../../utils/debug.js'
import { classifyAxiosError, getErrnoCode } from '../../utils/errors.js'
import { settingsChangeDetector } from '../../utils/settings/changeDetector.js'
import {
  type SettingsJson,
  SettingsSchema,
} from '../../utils/settings/types.js'
import { sleep } from '../../utils/sleep.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import { getClaudeCodeUserAgent } from '../../utils/userAgent.js'
import { getRetryDelay } from '../api/withRetry.js'
import {
  checkManagedSettingsSecurity,
  handleSecurityCheckResult,
} from './securityCheck.jsx'
import { isRemoteManagedSettingsEligible, resetSyncCache } from './syncCache.js'
import {
  getRemoteManagedSettingsSyncFromCache,
  getSettingsPath,
  setSessionCache,
} from './syncCacheState.js'
import {
  type RemoteManagedSettingsFetchResult,
  RemoteManagedSettingsResponseSchema,
} from './types.js'

// Constants
const SETTINGS_TIMEOUT_MS = 10000 // 10 seconds for settings fetch
const DEFAULT_MAX_RETRIES = 5
const POLLING_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

// Background polling state
let pollingIntervalId: ReturnType<typeof setInterval> | null = null

// Promise that resolves when initial remote settings loading completes
// This allows other systems to wait for remote settings before initializing
let loadingCompletePromise: Promise<void> | null = null
let loadingCompleteResolve: (() => void) | null = null

// Timeout for the loading promise to prevent deadlocks if loadRemoteManagedSettings() is never called
// (e.g., in Agent SDK tests that don't go through main.tsx)
const LOADING_PROMISE_TIMEOUT_MS = 30000 // 30 seconds

/**
 * Initialize the loading promise for remote managed settings
 * This should be called early (e.g., in init.ts) to allow other systems
 * to await remote settings loading even if loadRemoteManagedSettings()
 * hasn't been called yet.
 *
 * Only creates the promise if the user is eligible for remote settings.
 * Includes a timeout to prevent deadlocks if loadRemoteManagedSettings() is never called.
 */
export function initializeRemoteManagedSettingsLoadingPromise(): void {
  if (loadingCompletePromise) {
    return
  }

  if (isRemoteManagedSettingsEligible()) {
    loadingCompletePromise = new Promise(resolve => {
      loadingCompleteResolve = resolve

      // Set a timeout to resolve the promise even if loadRemoteManagedSettings() is never called
      // This prevents deadlocks in Agent SDK tests and other non-CLI contexts
      setTimeout(() => {
        if (loadingCompleteResolve) {
          logForDebugging(
            'Remote settings: Loading promise timed out, resolving anyway',
          )
          loadingCompleteResolve()
          loadingCompleteResolve = null
        }
      }, LOADING_PROMISE_TIMEOUT_MS)
    })
  }
}

/**
 * Get the remote settings API endpoint
 * Uses the OAuth config base API URL
 */
function getRemoteManagedSettingsEndpoint() {
  return `${getOauthConfig().BASE_API_URL}/api/claude_code/settings`
}

/**
 * Recursively sort all keys in an object to match Python's json.dumps(sort_keys=True)
 */
function sortKeysDeep(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(sortKeysDeep)
  }
  if (obj !== null && typeof obj === 'object') {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortKeysDeep((obj as Record<string, unknown>)[key])
    }
    return sorted
  }
  return obj
}

/**
 * Compute checksum from settings content for HTTP caching
 * Must match server's Python: json.dumps(settings, sort_keys=True, separators=(",", ":"))
 * Exported for testing to verify compatibility with server-side implementation
 */
export function computeChecksumFromSettings(settings: SettingsJson): string {
  const sorted = sortKeysDeep(settings)
  // No spaces after separators to match Python's separators=(",", ":")
  const normalized = jsonStringify(sorted)
  const hash = createHash('sha256').update(normalized).digest('hex')
  return `sha256:${hash}`
}

/**
 * Check if the current user is eligible for remote managed settings
 * This is the public API for other systems to check eligibility
 * Used to determine if they should wait for remote settings to load
 */
export function isEligibleForRemoteManagedSettings(): boolean {
  return isRemoteManagedSettingsEligible()
}

/**
 * Wait for the initial remote settings loading to complete
 * Returns immediately if:
 * - User is not eligible for remote settings
 * - Loading has already completed
 * - Loading was never started
 */
export async function waitForRemoteManagedSettingsToLoad(): Promise<void> {
  if (loadingCompletePromise) {
    await loadingCompletePromise
  }
}

/**
 * Get auth headers for remote settings without calling getSettings()
 * This avoids circular dependencies during settings loading
 * Supports both API key and OAuth authentication
 */
function getRemoteSettingsAuthHeaders(): {
  headers: Record<string, string>
  error?: string
} {
  // Try API key first (for Console users)
  // Skip apiKeyHelper to avoid circular dependency with getSettings()
  // Wrap in try-catch because getAnthropicApiKeyWithSource throws in CI/test environments
  try {
    const { key: apiKey } = getAnthropicApiKeyWithSource({
      skipRetrievingKeyFromApiKeyHelper: true,
    })
    if (apiKey) {
      return {
        headers: {
          'x-api-key': apiKey,
        },
      }
    }
  } catch {
    // No API key available - continue to check OAuth
  }

  // Fall back to OAuth tokens (for Claude.ai users)
  const oauthTokens = getClaudeAIOAuthTokens()
  if (oauthTokens?.accessToken) {
    return {
      headers: {
        Authorization: `Bearer ${oauthTokens.accessToken}`,
        'anthropic-beta': OAUTH_BETA_HEADER,
      },
    }
  }

  return {
    headers: {},
    error: 'No authentication available',
  }
}

/**
 * Fetch remote settings with retry logic and exponential backoff
 * Uses existing codebase retry utilities for consistency
 */
async function fetchWithRetry(
  cachedChecksum?: string,
): Promise<RemoteManagedSettingsFetchResult> {
  let lastResult: RemoteManagedSettingsFetchResult | null = null

  for (let attempt = 1; attempt <= DEFAULT_MAX_RETRIES + 1; attempt++) {
    lastResult = await fetchRemoteManagedSettings(cachedChecksum)

    // Return immediately on success
    if (lastResult.success) {
      return lastResult
    }

    // Don't retry if the error is not retryable (e.g., auth errors)
    if (lastResult.skipRetry) {
      return lastResult
    }

    // If we've exhausted retries, return the last error
    if (attempt > DEFAULT_MAX_RETRIES) {
      return lastResult
    }

    // Calculate delay and wait before next retry
    const delayMs = getRetryDelay(attempt)
    logForDebugging(
      `Remote settings: Retry ${attempt}/${DEFAULT_MAX_RETRIES} after ${delayMs}ms`,
    )
    await sleep(delayMs)
  }

  // Should never reach here, but TypeScript needs it
  return lastResult!
}

/**
 * Fetch the full remote settings (single attempt, no retries)
 * Optionally pass a cached checksum for ETag-based caching
 */
async function fetchRemoteManagedSettings(
  cachedChecksum?: string,
): Promise<RemoteManagedSettingsFetchResult> {
  try {
    // Ensure OAuth token is fresh before fetching settings
    // This prevents 401 errors from stale cached tokens
    await checkAndRefreshOAuthTokenIfNeeded()

    // Use local auth header getter to avoid circular dependency with getSettings()
    const authHeaders = getRemoteSettingsAuthHeaders()
    if (authHeaders.error) {
      // Auth errors should not be retried - return a special flag to skip retries
      return {
        success: false,
        error: `Authentication required for remote settings`,
        skipRetry: true,
      }
    }

    const endpoint = getRemoteManagedSettingsEndpoint()
    const headers: Record<string, string> = {
      ...authHeaders.headers,
      'User-Agent': getClaudeCodeUserAgent(),
    }

    // Add If-None-Match header for ETag-based caching
    if (cachedChecksum) {
      headers['If-None-Match'] = `"${cachedChecksum}"`
    }

    const response = await axios.get(endpoint, {
      headers,
      timeout: SETTINGS_TIMEOUT_MS,
      // Allow 204, 304, and 404 responses without treating them as errors.
      // 204/404 are returned when no settings exist for the user or the feature flag is off.
      validateStatus: status =>
        status === 200 || status === 204 || status === 304 || status === 404,
    })

    // Handle 304 Not Modified - cached version is still valid
    if (response.status === 304) {
      logForDebugging('Remote settings: Using cached settings (304)')
      return {
        success: true,
        settings: null, // Signal that cache is valid
        checksum: cachedChecksum,
      }
    }

    // Handle 204 No Content / 404 Not Found - no settings exist or feature flag is off.
    // Return empty object (not null) so callers don't fall back to cached settings.
    if (response.status === 204 || response.status === 404) {
      logForDebugging(`Remote settings: No settings found (${response.status})`)
      return {
        success: true,
        settings: {},
        checksum: undefined,
      }
    }

    const parsed = RemoteManagedSettingsResponseSchema().safeParse(
      response.data,
    )
    if (!parsed.success) {
      logForDebugging(
        `Remote settings: Invalid response format - ${parsed.error.message}`,
      )
      return {
        success: false,
        error: 'Invalid remote settings format',
      }
    }

    // Full validation of settings structure
    const settingsValidation = SettingsSchema().safeParse(parsed.data.settings)
    if (!settingsValidation.success) {
      logForDebugging(
        `Remote settings: Settings validation failed - ${settingsValidation.error.message}`,
      )
      return {
        success: false,
        error: 'Invalid settings structure',
      }
    }

    logForDebugging('Remote settings: Fetched successfully')
    return {
      success: true,
      settings: settingsValidation.data,
      checksum: parsed.data.checksum,
    }
  } catch (error) {
    const { kind, status, message } = classifyAxiosError(error)
    if (status === 404) {
      // 404 means no remote settings configured
      return { success: true, settings: {}, checksum: '' }
    }
    switch (kind) {
      case 'auth':
        // Auth errors (401, 403) should not be retried - the API key doesn't have access
        return {
          success: false,
          error: 'Not authorized for remote settings',
          skipRetry: true,
        }
      case 'timeout':
        return { success: false, error: 'Remote settings request timeout' }
      case 'network':
        return { success: false, error: 'Cannot connect to server' }
      default:
        return { success: false, error: message }
    }
  }
}

/**
 * Save remote settings to file
 * Stores raw settings JSON (checksum is computed on-demand when needed)
 */
async function saveSettings(settings: SettingsJson): Promise<void> {
  try {
    const path = getSettingsPath()
    const handle = await open(path, 'w', 0o600)
    try {
      await handle.writeFile(jsonStringify(settings, null, 2), {
        encoding: 'utf-8',
      })
      await handle.datasync()
    } finally {
      await handle.close()
    }
    logForDebugging(`Remote settings: Saved to ${path}`)
  } catch (error) {
    logForDebugging(
      `Remote settings: Failed to save - ${error instanceof Error ? error.message : 'unknown error'}`,
    )
    // Ignore save errors - we'll refetch on next startup
  }
}

/**
 * Clear all remote settings (session, persistent, and stop polling)
 */
export async function clearRemoteManagedSettingsCache(): Promise<void> {
  // Stop background polling
  stopBackgroundPolling()

  // Clear session cache
  resetSyncCache()

  // Clear loading promise state
  loadingCompletePromise = null
  loadingCompleteResolve = null

  try {
    const path = getSettingsPath()
    await unlink(path)
  } catch {
    // Ignore errors when clearing file (ENOENT is expected)
  }
}

/**
 * Fetch and load remote settings with file caching
 * Internal function that handles the full load/fetch logic
 * Fails open - returns null if fetch fails and no cache exists
 */
async function fetchAndLoadRemoteManagedSettings(): Promise<SettingsJson | null> {
  if (!isRemoteManagedSettingsEligible()) {
    return null
  }

  // Load cached settings from file
  const cachedSettings = getRemoteManagedSettingsSyncFromCache()

  // Compute checksum locally from cached settings for HTTP caching validation
  const cachedChecksum = cachedSettings
    ? computeChecksumFromSettings(cachedSettings)
    : undefined

  try {
    // Fetch settings from API with retry logic
    const result = await fetchWithRetry(cachedChecksum)

    if (!result.success) {
      // On fetch failure, use stale file if available (graceful degradation)
      if (cachedSettings) {
        logForDebugging(
          'Remote settings: Using stale cache after fetch failure',
        )
        setSessionCache(cachedSettings)
        return cachedSettings
      }
      // No cache available - fail open, continue without remote settings
      return null
    }

    // Handle 304 Not Modified - cached settings are still valid
    if (result.settings === null && cachedSettings) {
      logForDebugging('Remote settings: Cache still valid (304 Not Modified)')
      setSessionCache(cachedSettings)
      return cachedSettings
    }

    // Save new settings to file (only if non-empty)
    const newSettings = result.settings || {}
    const hasContent = Object.keys(newSettings).length > 0

    if (hasContent) {
      // Check for dangerous settings changes before applying
      const securityResult = await checkManagedSettingsSecurity(
        cachedSettings,
        newSettings,
      )
      if (!handleSecurityCheckResult(securityResult)) {
        // User rejected - don't apply settings, return cached or null
        logForDebugging(
          'Remote settings: User rejected new settings, using cached settings',
        )
        return cachedSettings
      }

      setSessionCache(newSettings)
      await saveSettings(newSettings)
      logForDebugging('Remote settings: Applied new settings successfully')
      return newSettings
    }

    // Empty settings (404 response) - delete cached file if it exists
    // This ensures stale settings don't persist when a user's remote settings are removed
    setSessionCache(newSettings)
    try {
      const path = getSettingsPath()
      await unlink(path)
      logForDebugging('Remote settings: Deleted cached file (404 response)')
    } catch (e) {
      const code = getErrnoCode(e)
      if (code !== 'ENOENT') {
        logForDebugging(
          `Remote settings: Failed to delete cached file - ${e instanceof Error ? e.message : 'unknown error'}`,
        )
      }
    }
    return newSettings
  } catch {
    // On any error, use stale file if available (graceful degradation)
    if (cachedSettings) {
      logForDebugging('Remote settings: Using stale cache after error')
      setSessionCache(cachedSettings)
      return cachedSettings
    }

    // No cache available - fail open, continue without remote settings
    return null
  }
}

/**
 * Load remote settings during CLI initialization
 * Fails open - if fetch fails, continues without remote settings
 * Also starts background polling to pick up settings changes mid-session
 *
 * This function sets up a promise that other systems can await via
 * waitForRemoteManagedSettingsToLoad() to ensure they don't initialize
 * until remote settings have been fetched.
 */
export async function loadRemoteManagedSettings(): Promise<void> {
  // Set up the promise for other systems to wait on
  // Only if the user is eligible for remote settings AND promise not already set up
  // (initializeRemoteManagedSettingsLoadingPromise may have been called earlier)
  if (isRemoteManagedSettingsEligible() && !loadingCompletePromise) {
    loadingCompletePromise = new Promise(resolve => {
      loadingCompleteResolve = resolve
    })
  }

  // Cache-first: if we have cached settings on disk, apply them and unblock
  // waiters immediately. The fetch still runs below; notifyChange fires once,
  // after the fetch, as before. Saves the ~77ms fetch-wait on print-mode startup.
  // getRemoteManagedSettingsSyncFromCache has the eligibility guard and populates
  // the session cache internally — no need to call setSessionCache here.
  if (getRemoteManagedSettingsSyncFromCache() && loadingCompleteResolve) {
    loadingCompleteResolve()
    loadingCompleteResolve = null
  }

  try {
    const settings = await fetchAndLoadRemoteManagedSettings()

    // Start background polling to pick up settings changes mid-session
    if (isRemoteManagedSettingsEligible()) {
      startBackgroundPolling()
    }

    // Trigger hot-reload if settings were loaded (new or from cache).
    // notifyChange resets the settings cache internally before iterating
    // listeners — env vars, telemetry, and permissions update on next read.
    if (settings !== null) {
      settingsChangeDetector.notifyChange('policySettings')
    }
  } finally {
    // Always resolve the promise, even if fetch failed (fail-open)
    if (loadingCompleteResolve) {
      loadingCompleteResolve()
      loadingCompleteResolve = null
    }
  }
}

/**
 * Refresh remote settings asynchronously (for auth state changes)
 * This is used when login/logout occurs
 * Fails open - if fetch fails, continues without remote settings
 */
export async function refreshRemoteManagedSettings(): Promise<void> {
  // Clear caches first
  await clearRemoteManagedSettingsCache()

  // If not enabled, notify that policy settings changed (to empty)
  if (!isRemoteManagedSettingsEligible()) {
    settingsChangeDetector.notifyChange('policySettings')
    return
  }

  // Try to load new settings (fails open if fetch fails)
  await fetchAndLoadRemoteManagedSettings()
  logForDebugging('Remote settings: Refreshed after auth change')

  // Notify listeners. notifyChange resets the settings cache internally;
  // this triggers hot-reload (AppState update, env var application, etc.)
  settingsChangeDetector.notifyChange('policySettings')
}

/**
 * Background polling callback - fetches settings and triggers hot-reload if changed
 */
async function pollRemoteSettings(): Promise<void> {
  if (!isRemoteManagedSettingsEligible()) {
    return
  }

  // Get current cached settings for comparison
  const prevCache = getRemoteManagedSettingsSyncFromCache()
  const previousSettings = prevCache ? jsonStringify(prevCache) : null

  try {
    await fetchAndLoadRemoteManagedSettings()

    // Check if settings actually changed
    const newCache = getRemoteManagedSettingsSyncFromCache()
    const newSettings = newCache ? jsonStringify(newCache) : null
    if (newSettings !== previousSettings) {
      logForDebugging('Remote settings: Changed during background poll')
      settingsChangeDetector.notifyChange('policySettings')
    }
  } catch {
    // Don't fail closed for background polling - just continue
  }
}

/**
 * Start background polling for remote settings
 * Polls every hour to pick up settings changes mid-session
 */
export function startBackgroundPolling(): void {
  if (pollingIntervalId !== null) {
    return
  }

  if (!isRemoteManagedSettingsEligible()) {
    return
  }

  pollingIntervalId = setInterval(() => {
    void pollRemoteSettings()
  }, POLLING_INTERVAL_MS)
  pollingIntervalId.unref()

  // Register cleanup to stop polling on shutdown
  registerCleanup(async () => stopBackgroundPolling())
}

/**
 * Stop background polling for remote settings
 */
export function stopBackgroundPolling(): void {
  if (pollingIntervalId !== null) {
    clearInterval(pollingIntervalId)
    pollingIntervalId = null
  }
}
