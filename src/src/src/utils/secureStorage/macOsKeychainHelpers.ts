/**
 * Lightweight helpers shared between keychainPrefetch.ts and
 * macOsKeychainStorage.ts.
 *
 * This module MUST NOT import execa, execFileNoThrow, or
 * execFileNoThrowPortable. keychainPrefetch.ts fires at the very top of
 * main.tsx (before the ~65ms of module evaluation it parallelizes), and Bun's
 * __esm wrapper evaluates the ENTIRE module when any symbol is accessed —
 * so a heavy transitive import here defeats the prefetch. The execa →
 * human-signals → cross-spawn chain alone is ~58ms of synchronous init.
 *
 * The imports below (envUtils, oauth constants, crypto, os) are already
 * evaluated by startupProfiler.ts at main.tsx:5, so they add no module-init
 * cost when keychainPrefetch.ts pulls this file in.
 */

import { createHash } from 'crypto'
import { userInfo } from 'os'
import { getOauthConfig } from 'src/constants/oauth.js'
import { getClaudeConfigHomeDir } from '../envUtils.js'
import type { SecureStorageData } from './types.js'

// Suffix distinguishing the OAuth credentials keychain entry from the legacy
// API key entry (which uses no suffix). Both share the service name base.
// DO NOT change this value — it's part of the keychain lookup key and would
// orphan existing stored credentials.
export const CREDENTIALS_SERVICE_SUFFIX = '-credentials'

export function getMacOsKeychainStorageServiceName(
  serviceSuffix: string = '',
): string {
  const configDir = getClaudeConfigHomeDir()
  const isDefaultDir = !process.env.CLAUDE_CONFIG_DIR

  // Use a hash of the config dir path to create a unique but stable suffix
  // Only add suffix for non-default directories to maintain backwards compatibility
  const dirHash = isDefaultDir
    ? ''
    : `-${createHash('sha256').update(configDir).digest('hex').substring(0, 8)}`
  return `Claude Code${getOauthConfig().OAUTH_FILE_SUFFIX}${serviceSuffix}${dirHash}`
}

export function getUsername(): string {
  try {
    return process.env.USER || userInfo().username
  } catch {
    return 'claude-code-user'
  }
}

// --

// Cache for keychain reads to avoid repeated expensive security CLI calls.
// TTL bounds staleness for cross-process scenarios (another CC instance
// refreshing/invalidating tokens) without forcing a blocking spawnSync on
// every read. In-process writes invalidate via clearKeychainCache() directly.
//
// The sync read() path takes ~500ms per `security` spawn. With 50+ claude.ai
// MCP connectors authenticating at startup, a short TTL expires mid-storm and
// triggers repeat sync reads — observed as a 5.5s event-loop stall
// (go/ccshare/adamj-20260326-212235). 30s of cross-process staleness is fine:
// OAuth tokens expire in hours, and the only cross-process writer is another
// CC instance's /login or refresh.
//
// Lives here (not in macOsKeychainStorage.ts) so keychainPrefetch.ts can
// prime it without pulling in execa. Wrapped in an object because ES module
// `let` bindings aren't writable across module boundaries — both this file
// and macOsKeychainStorage.ts need to mutate all three fields.
export const KEYCHAIN_CACHE_TTL_MS = 30_000

export const keychainCacheState: {
  cache: { data: SecureStorageData | null; cachedAt: number } // cachedAt 0 = invalid
  // Incremented on every cache invalidation. readAsync() captures this before
  // spawning and skips its cache write if a newer generation exists, preventing
  // a stale subprocess result from overwriting fresh data written by update().
  generation: number
  // Deduplicates concurrent readAsync() calls so TTL expiry under load spawns
  // one subprocess, not N. Cleared on invalidation so fresh reads don't join
  // a stale in-flight promise.
  readInFlight: Promise<SecureStorageData | null> | null
} = {
  cache: { data: null, cachedAt: 0 },
  generation: 0,
  readInFlight: null,
}

export function clearKeychainCache(): void {
  keychainCacheState.cache = { data: null, cachedAt: 0 }
  keychainCacheState.generation++
  keychainCacheState.readInFlight = null
}

/**
 * Prime the keychain cache from a prefetch result (keychainPrefetch.ts).
 * Only writes if the cache hasn't been touched yet — if sync read() or
 * update() already ran, their result is authoritative and we discard this.
 */
export function primeKeychainCacheFromPrefetch(stdout: string | null): void {
  if (keychainCacheState.cache.cachedAt !== 0) return
  let data: SecureStorageData | null = null
  if (stdout) {
    try {
      // eslint-disable-next-line custom-rules/no-direct-json-operations -- jsonParse() pulls slowOperations (lodash-es/cloneDeep) into the early-startup import chain; see file header
      data = JSON.parse(stdout)
    } catch {
      // malformed prefetch result — let sync read() re-fetch
      return
    }
  }
  keychainCacheState.cache = { data, cachedAt: Date.now() }
}
