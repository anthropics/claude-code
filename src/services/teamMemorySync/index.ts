/**
 * Team Memory Sync Service
 *
 * Syncs team memory files between the local filesystem and the server API.
 * Team memory is scoped per-repo (identified by git remote hash) and shared
 * across all authenticated org members.
 *
 * API contract (anthropic/anthropic#250711 + #283027):
 *   GET  /api/claude_code/team_memory?repo={owner/repo}            → TeamMemoryData (includes entryChecksums)
 *   GET  /api/claude_code/team_memory?repo={owner/repo}&view=hashes → metadata + entryChecksums only (no entry bodies)
 *   PUT  /api/claude_code/team_memory?repo={owner/repo}            → upload entries (upsert semantics)
 *   404 = no data exists yet
 *
 * Sync semantics:
 *   - Pull overwrites local files with server content (server wins per-key).
 *   - Push uploads only keys whose content hash differs from serverChecksums
 *     (delta upload). Server uses upsert: keys not in the PUT are preserved.
 *   - File deletions do NOT propagate: deleting a local file won't remove it
 *     from the server, and the next pull will restore it locally.
 *
 * State management:
 *   All mutable state (ETag tracking, watcher suppression) lives in a
 *   SyncState object created by the caller and threaded through every call.
 *   This avoids module-level mutable state and gives tests natural isolation.
 */

import axios from 'axios'
import { createHash } from 'crypto'
import { mkdir, readdir, readFile, stat, writeFile } from 'fs/promises'
import { join, relative, sep } from 'path'
import {
  CLAUDE_AI_INFERENCE_SCOPE,
  CLAUDE_AI_PROFILE_SCOPE,
  getOauthConfig,
  OAUTH_BETA_HEADER,
} from '../../constants/oauth.js'
import {
  getTeamMemPath,
  PathTraversalError,
  validateTeamMemKey,
} from '../../memdir/teamMemPaths.js'
import { count } from '../../utils/array.js'
import {
  checkAndRefreshOAuthTokenIfNeeded,
  getClaudeAIOAuthTokens,
} from '../../utils/auth.js'
import { logForDebugging } from '../../utils/debug.js'
import { classifyAxiosError } from '../../utils/errors.js'
import { getGithubRepo } from '../../utils/git.js'
import {
  getAPIProvider,
  isFirstPartyAnthropicBaseUrl,
} from '../../utils/model/providers.js'
import { sleep } from '../../utils/sleep.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import { getClaudeCodeUserAgent } from '../../utils/userAgent.js'
import { logEvent } from '../analytics/index.js'
import type { AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from '../analytics/metadata.js'
import { getRetryDelay } from '../api/withRetry.js'
import { scanForSecrets } from './secretScanner.js'
import {
  type SkippedSecretFile,
  TeamMemoryDataSchema,
  type TeamMemoryHashesResult,
  type TeamMemorySyncFetchResult,
  type TeamMemorySyncPushResult,
  type TeamMemorySyncUploadResult,
  TeamMemoryTooManyEntriesSchema,
} from './types.js'

const TEAM_MEMORY_SYNC_TIMEOUT_MS = 30_000
// Per-entry size cap — server default from anthropic/anthropic#293258.
// Pre-filtering oversized entries saves bandwidth: the structured 413 for
// this case doesn't give us anything to learn (one file is just too big).
const MAX_FILE_SIZE_BYTES = 250_000
// No client-side DEFAULT_MAX_ENTRIES: the server's entry-count cap is
// GB-tunable per-org (claude_code_team_memory_limits), so any compile-time
// constant here will drift.  We only truncate after learning the effective
// limit from a structured 413's extra_details.max_entries.
// Gateway body-size cap.  The API gateway rejects PUT bodies over ~256-512KB
// with an unstructured (HTML) 413 before the request reaches the app server —
// distinguishable from the app's structured entry-count 413 only by latency
// (~750ms gateway vs ~2.3s app on comparable payloads).  #21969 removed the
// client entry-count cap; cold pushes from heavy users then sent 300KB-1.4MB
// bodies and hit this.  200KB leaves headroom under the observed threshold
// and keeps a single-entry-at-MAX_FILE_SIZE_BYTES solo batch (~250KB) just
// under the real gateway limit.  Batches larger than this are split into
// sequential PUTs — server upsert-merge semantics make that safe.
const MAX_PUT_BODY_BYTES = 200_000
const MAX_RETRIES = 3
const MAX_CONFLICT_RETRIES = 2

// ─── Sync state ─────────────────────────────────────────────

/**
 * Mutable state for the team memory sync service.
 * Created once per session by the watcher and passed to all sync functions.
 * Tests create a fresh instance per test for isolation.
 */
export type SyncState = {
  /** Last known server checksum (ETag) for conditional requests. */
  lastKnownChecksum: string | null
  /**
   * Per-key content hash (`sha256:<hex>`) of what we believe the server
   * currently holds. Populated from server-provided entryChecksums on pull
   * and from local hashes on successful push. Used to compute the delta on
   * push — only keys whose local hash differs are uploaded.
   */
  serverChecksums: Map<string, string>
  /**
   * Server-enforced max_entries cap, learned from a structured 413 response
   * (anthropic/anthropic#293258 adds error_code + extra_details.max_entries).
   * Stays null until a 413 is observed — the server's cap is GB-tunable
   * per-org so there is no correct client-side default.  While null,
   * readLocalTeamMemory sends everything and lets the server be
   * authoritative (it rejects atomically).
   */
  serverMaxEntries: number | null
}

export function createSyncState(): SyncState {
  return {
    lastKnownChecksum: null,
    serverChecksums: new Map(),
    serverMaxEntries: null,
  }
}

/**
 * Compute `sha256:<hex>` over the UTF-8 bytes of the given content.
 * Format matches the server's entryChecksums values (anthropic/anthropic#283027)
 * so local-vs-server comparison works by direct string equality.
 */
export function hashContent(content: string): string {
  return 'sha256:' + createHash('sha256').update(content, 'utf8').digest('hex')
}

/**
 * Type guard narrowing an unknown error to a Node.js errno-style exception.
 * Uses `in` narrowing so no `as` cast is needed at call sites.
 */
function isErrnoException(e: unknown): e is NodeJS.ErrnoException {
  return e instanceof Error && 'code' in e && typeof e.code === 'string'
}

// ─── Auth & endpoint ─────────────────────────────────────────

/**
 * Check if user is authenticated with first-party OAuth (required for team memory sync).
 */
function isUsingOAuth(): boolean {
  if (getAPIProvider() !== 'firstParty' || !isFirstPartyAnthropicBaseUrl()) {
    return false
  }
  const tokens = getClaudeAIOAuthTokens()
  return Boolean(
    tokens?.accessToken &&
      tokens.scopes?.includes(CLAUDE_AI_INFERENCE_SCOPE) &&
      tokens.scopes.includes(CLAUDE_AI_PROFILE_SCOPE),
  )
}

function getTeamMemorySyncEndpoint(repoSlug: string): string {
  const baseUrl =
    process.env.TEAM_MEMORY_SYNC_URL || getOauthConfig().BASE_API_URL
  return `${baseUrl}/api/claude_code/team_memory?repo=${encodeURIComponent(repoSlug)}`
}

function getAuthHeaders(): {
  headers?: Record<string, string>
  error?: string
} {
  const oauthTokens = getClaudeAIOAuthTokens()
  if (oauthTokens?.accessToken) {
    return {
      headers: {
        Authorization: `Bearer ${oauthTokens.accessToken}`,
        'anthropic-beta': OAUTH_BETA_HEADER,
        'User-Agent': getClaudeCodeUserAgent(),
      },
    }
  }
  return { error: 'No OAuth token available for team memory sync' }
}

// ─── Fetch (pull) ────────────────────────────────────────────

async function fetchTeamMemoryOnce(
  state: SyncState,
  repoSlug: string,
  etag?: string | null,
): Promise<TeamMemorySyncFetchResult> {
  try {
    await checkAndRefreshOAuthTokenIfNeeded()

    const auth = getAuthHeaders()
    if (auth.error) {
      return {
        success: false,
        error: auth.error,
        skipRetry: true,
        errorType: 'auth',
      }
    }

    const headers: Record<string, string> = { ...auth.headers }
    if (etag) {
      headers['If-None-Match'] = `"${etag.replace(/"/g, '')}"`
    }

    const endpoint = getTeamMemorySyncEndpoint(repoSlug)
    const response = await axios.get(endpoint, {
      headers,
      timeout: TEAM_MEMORY_SYNC_TIMEOUT_MS,
      validateStatus: status =>
        status === 200 || status === 304 || status === 404,
    })

    if (response.status === 304) {
      logForDebugging('team-memory-sync: not modified (304)', {
        level: 'debug',
      })
      return { success: true, notModified: true, checksum: etag ?? undefined }
    }

    if (response.status === 404) {
      logForDebugging('team-memory-sync: no remote data (404)', {
        level: 'debug',
      })
      state.lastKnownChecksum = null
      return { success: true, isEmpty: true }
    }

    const parsed = TeamMemoryDataSchema().safeParse(response.data)
    if (!parsed.success) {
      logForDebugging('team-memory-sync: invalid response format', {
        level: 'warn',
      })
      return {
        success: false,
        error: 'Invalid team memory response format',
        skipRetry: true,
        errorType: 'parse',
      }
    }

    // Extract checksum from response data or ETag header
    const responseChecksum =
      parsed.data.checksum ||
      response.headers['etag']?.replace(/^"|"$/g, '') ||
      undefined
    if (responseChecksum) {
      state.lastKnownChecksum = responseChecksum
    }

    logForDebugging(
      `team-memory-sync: fetched successfully (checksum: ${responseChecksum ?? 'none'})`,
      { level: 'debug' },
    )
    return {
      success: true,
      data: parsed.data,
      isEmpty: false,
      checksum: responseChecksum,
    }
  } catch (error) {
    const { kind, status, message } = classifyAxiosError(error)
    const body = axios.isAxiosError(error)
      ? JSON.stringify(error.response?.data ?? '')
      : ''
    if (kind !== 'other') {
      logForDebugging(`team-memory-sync: fetch error ${status}: ${body}`, {
        level: 'warn',
      })
    }
    switch (kind) {
      case 'auth':
        return {
          success: false,
          error: `Not authorized for team memory sync: ${body}`,
          skipRetry: true,
          errorType: 'auth',
          httpStatus: status,
        }
      case 'timeout':
        return {
          success: false,
          error: 'Team memory sync request timeout',
          errorType: 'timeout',
        }
      case 'network':
        return {
          success: false,
          error: 'Cannot connect to server',
          errorType: 'network',
        }
      default:
        return {
          success: false,
          error: message,
          errorType: 'unknown',
          httpStatus: status,
        }
    }
  }
}

/**
 * Fetch only per-key checksums + metadata (no entry bodies).
 * Used for cheap serverChecksums refresh during 412 conflict resolution — avoids
 * downloading ~300KB of content just to learn which keys changed.
 * Requires anthropic/anthropic#283027 deployed; on failure the caller fails the
 * push and the watcher retries on the next edit.
 */
async function fetchTeamMemoryHashes(
  state: SyncState,
  repoSlug: string,
): Promise<TeamMemoryHashesResult> {
  try {
    await checkAndRefreshOAuthTokenIfNeeded()
    const auth = getAuthHeaders()
    if (auth.error) {
      return { success: false, error: auth.error, errorType: 'auth' }
    }

    const endpoint = getTeamMemorySyncEndpoint(repoSlug) + '&view=hashes'
    const response = await axios.get(endpoint, {
      headers: auth.headers,
      timeout: TEAM_MEMORY_SYNC_TIMEOUT_MS,
      validateStatus: status => status === 200 || status === 404,
    })

    if (response.status === 404) {
      state.lastKnownChecksum = null
      return { success: true, entryChecksums: {} }
    }

    const checksum =
      response.data?.checksum || response.headers['etag']?.replace(/^"|"$/g, '')
    const entryChecksums = response.data?.entryChecksums

    // Requires anthropic/anthropic#283027. If entryChecksums is missing,
    // treat as a probe failure — caller fails the push; watcher retries.
    if (!entryChecksums || typeof entryChecksums !== 'object') {
      return {
        success: false,
        error:
          'Server did not return entryChecksums (?view=hashes unsupported)',
        errorType: 'parse',
      }
    }

    if (checksum) {
      state.lastKnownChecksum = checksum
    }
    return {
      success: true,
      version: response.data?.version,
      checksum,
      entryChecksums,
    }
  } catch (error) {
    const { kind, status, message } = classifyAxiosError(error)
    switch (kind) {
      case 'auth':
        return {
          success: false,
          error: 'Not authorized',
          errorType: 'auth',
          httpStatus: status,
        }
      case 'timeout':
        return { success: false, error: 'Timeout', errorType: 'timeout' }
      case 'network':
        return { success: false, error: 'Network error', errorType: 'network' }
      default:
        return {
          success: false,
          error: message,
          errorType: 'unknown',
          httpStatus: status,
        }
    }
  }
}

async function fetchTeamMemory(
  state: SyncState,
  repoSlug: string,
  etag?: string | null,
): Promise<TeamMemorySyncFetchResult> {
  let lastResult: TeamMemorySyncFetchResult | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    lastResult = await fetchTeamMemoryOnce(state, repoSlug, etag)
    if (lastResult.success || lastResult.skipRetry) {
      return lastResult
    }
    if (attempt > MAX_RETRIES) {
      return lastResult
    }
    const delayMs = getRetryDelay(attempt)
    logForDebugging(`team-memory-sync: retry ${attempt}/${MAX_RETRIES}`, {
      level: 'debug',
    })
    await sleep(delayMs)
  }

  return lastResult!
}

// ─── Upload (push) ───────────────────────────────────────────

/**
 * Split a delta into PUT-sized batches under MAX_PUT_BODY_BYTES each.
 *
 * Greedy bin-packing over sorted keys — sorting gives deterministic batches
 * across calls, which matters for ETag stability if the conflict loop retries
 * after a partial commit.  The byte count is the full serialized body
 * including JSON overhead, so what we measure is what axios sends.
 *
 * A single entry exceeding MAX_PUT_BODY_BYTES goes into its own solo batch
 * (MAX_FILE_SIZE_BYTES=250K already caps individual files; a ~250K solo body
 * is above our soft cap but below the gateway's observed real threshold).
 */
export function batchDeltaByBytes(
  delta: Record<string, string>,
): Array<Record<string, string>> {
  const keys = Object.keys(delta).sort()
  if (keys.length === 0) return []

  // Fixed overhead for `{"entries":{}}` — each entry then adds its marginal
  // bytes.  jsonStringify (≡ JSON.stringify under the hood) on the raw
  // strings handles escaping so the count matches what axios serializes.
  const EMPTY_BODY_BYTES = Buffer.byteLength('{"entries":{}}', 'utf8')
  const entryBytes = (k: string, v: string): number =>
    Buffer.byteLength(jsonStringify(k), 'utf8') +
    Buffer.byteLength(jsonStringify(v), 'utf8') +
    2 // colon + comma (comma over-counts by 1 on the last entry; harmless slack)

  const batches: Array<Record<string, string>> = []
  let current: Record<string, string> = {}
  let currentBytes = EMPTY_BODY_BYTES

  for (const key of keys) {
    const added = entryBytes(key, delta[key]!)
    if (
      currentBytes + added > MAX_PUT_BODY_BYTES &&
      Object.keys(current).length > 0
    ) {
      batches.push(current)
      current = {}
      currentBytes = EMPTY_BODY_BYTES
    }
    current[key] = delta[key]!
    currentBytes += added
  }
  batches.push(current)
  return batches
}

async function uploadTeamMemory(
  state: SyncState,
  repoSlug: string,
  entries: Record<string, string>,
  ifMatchChecksum?: string | null,
): Promise<TeamMemorySyncUploadResult> {
  try {
    await checkAndRefreshOAuthTokenIfNeeded()

    const auth = getAuthHeaders()
    if (auth.error) {
      return { success: false, error: auth.error, errorType: 'auth' }
    }

    const headers: Record<string, string> = {
      ...auth.headers,
      'Content-Type': 'application/json',
    }
    if (ifMatchChecksum) {
      headers['If-Match'] = `"${ifMatchChecksum.replace(/"/g, '')}"`
    }

    const endpoint = getTeamMemorySyncEndpoint(repoSlug)
    const response = await axios.put(
      endpoint,
      { entries },
      {
        headers,
        timeout: TEAM_MEMORY_SYNC_TIMEOUT_MS,
        validateStatus: status => status === 200 || status === 412,
      },
    )

    if (response.status === 412) {
      logForDebugging('team-memory-sync: conflict (412 Precondition Failed)', {
        level: 'info',
      })
      return { success: false, conflict: true, error: 'ETag mismatch' }
    }

    const responseChecksum = response.data?.checksum
    if (responseChecksum) {
      state.lastKnownChecksum = responseChecksum
    }

    logForDebugging(
      `team-memory-sync: uploaded ${Object.keys(entries).length} entries (checksum: ${responseChecksum ?? 'none'})`,
      { level: 'debug' },
    )
    return {
      success: true,
      checksum: responseChecksum,
      lastModified: response.data?.lastModified,
    }
  } catch (error) {
    const body = axios.isAxiosError(error)
      ? JSON.stringify(error.response?.data ?? '')
      : ''
    logForDebugging(
      `team-memory-sync: upload failed: ${error instanceof Error ? error.message : ''} ${body}`,
      { level: 'warn' },
    )
    const { kind, status: httpStatus, message } = classifyAxiosError(error)
    const errorType = kind === 'http' || kind === 'other' ? 'unknown' : kind
    let serverErrorCode: 'team_memory_too_many_entries' | undefined
    let serverMaxEntries: number | undefined
    let serverReceivedEntries: number | undefined
    // Parse structured 413 (anthropic/anthropic#293258). The server's
    // RequestTooLargeException includes error_code + extra_details with
    // the effective max_entries (may be GB-tuned per-org). Cache it so
    // the next push trims to the right value.
    if (httpStatus === 413 && axios.isAxiosError(error)) {
      const parsed = TeamMemoryTooManyEntriesSchema().safeParse(
        error.response?.data,
      )
      if (parsed.success) {
        serverErrorCode = parsed.data.error.details.error_code
        serverMaxEntries = parsed.data.error.details.max_entries
        serverReceivedEntries = parsed.data.error.details.received_entries
      }
    }
    return {
      success: false,
      error: message,
      errorType,
      httpStatus,
      ...(serverErrorCode !== undefined && { serverErrorCode }),
      ...(serverMaxEntries !== undefined && { serverMaxEntries }),
      ...(serverReceivedEntries !== undefined && { serverReceivedEntries }),
    }
  }
}

// ─── Local file operations ───────────────────────────────────

/**
 * Read all team memory files from the local directory into a flat key-value map.
 * Keys are relative paths from the team memory directory.
 * Empty files are included (content will be empty string).
 *
 * PSR M22174: Each file is scanned for credentials before inclusion
 * using patterns from gitleaks. Files containing secrets are SKIPPED
 * (not uploaded) and collected in skippedSecrets so the caller can
 * warn the user.
 */
async function readLocalTeamMemory(maxEntries: number | null): Promise<{
  entries: Record<string, string>
  skippedSecrets: SkippedSecretFile[]
}> {
  const teamDir = getTeamMemPath()
  const entries: Record<string, string> = {}
  const skippedSecrets: SkippedSecretFile[] = []

  async function walkDir(dir: string): Promise<void> {
    try {
      const dirEntries = await readdir(dir, { withFileTypes: true })
      await Promise.all(
        dirEntries.map(async entry => {
          const fullPath = join(dir, entry.name)
          if (entry.isDirectory()) {
            await walkDir(fullPath)
          } else if (entry.isFile()) {
            try {
              const stats = await stat(fullPath)
              if (stats.size > MAX_FILE_SIZE_BYTES) {
                logForDebugging(
                  `team-memory-sync: skipping oversized file ${entry.name} (${stats.size} > ${MAX_FILE_SIZE_BYTES} bytes)`,
                  { level: 'info' },
                )
                return
              }
              const content = await readFile(fullPath, 'utf8')
              const relPath = relative(teamDir, fullPath).replaceAll('\\', '/')

              // PSR M22174: scan for secrets BEFORE adding to the upload
              // payload. If a secret is detected, skip this file entirely
              // so it never leaves the machine.
              const secretMatches = scanForSecrets(content)
              if (secretMatches.length > 0) {
                // Report only the first match per file — one secret is
                // enough to skip the file and we don't want to log more
                // than necessary about credential locations.
                const firstMatch = secretMatches[0]!
                skippedSecrets.push({
                  path: relPath,
                  ruleId: firstMatch.ruleId,
                  label: firstMatch.label,
                })
                logForDebugging(
                  `team-memory-sync: skipping "${relPath}" — detected ${firstMatch.label}`,
                  { level: 'warn' },
                )
                return
              }

              entries[relPath] = content
            } catch {
              // Skip unreadable files
            }
          }
        }),
      )
    } catch (e) {
      if (isErrnoException(e)) {
        if (e.code !== 'ENOENT' && e.code !== 'EACCES' && e.code !== 'EPERM') {
          throw e
        }
      } else {
        throw e
      }
    }
  }

  await walkDir(teamDir)

  // Truncate only if we've LEARNED a cap from the server (via a structured
  // 413's extra_details.max_entries — anthropic/anthropic#293258).  The
  // server's entry-count cap is GB-tunable per-org via
  // claude_code_team_memory_limits; we have no way to know it in advance.
  // Before the first 413 we send everything and let the server be
  // authoritative.  The server validates total stored entries after merge
  // (not PUT body count) and rejects atomically — nothing is written on 413.
  //
  // Sorting before truncation is what makes delta computation work: without
  // it, the parallel walk above picks a different N-of-M subset each push
  // (Promise.all resolves in completion order), serverChecksums misses keys,
  // and the "delta" balloons to near-full snapshot.  With deterministic
  // truncation, the same N keys are compared against the same server state.
  //
  // When disk has more files than the learned cap, alphabetically-last ones
  // consistently never sync.  When the merged (server + delta) count exceeds
  // the cap we still fail — recovering requires soft_delete_keys.
  const keys = Object.keys(entries).sort()
  if (maxEntries !== null && keys.length > maxEntries) {
    const dropped = keys.slice(maxEntries)
    logForDebugging(
      `team-memory-sync: ${keys.length} local entries exceeds server cap of ${maxEntries}; ${dropped.length} file(s) will NOT sync: ${dropped.join(', ')}. Consider consolidating or removing some team memory files.`,
      { level: 'warn' },
    )
    logEvent('tengu_team_mem_entries_capped', {
      total_entries: keys.length,
      dropped_count: dropped.length,
      max_entries: maxEntries,
    })
    const truncated: Record<string, string> = {}
    for (const key of keys.slice(0, maxEntries)) {
      truncated[key] = entries[key]!
    }
    return { entries: truncated, skippedSecrets }
  }
  return { entries, skippedSecrets }
}

/**
 * Write remote team memory entries to the local directory.
 * Validates every path against the team memory directory boundary.
 * Skips entries whose on-disk content already matches, so unchanged
 * files keep their mtime and don't spuriously invalidate the
 * getMemoryFiles cache or trigger watcher events.
 *
 * Parallel: each entry is processed independently (validate + read-compare
 * + mkdir + write). Concurrent mkdir on a shared parent is safe with
 * recursive: true (EEXIST is swallowed). The initial pull is the long
 * pole in startTeamMemoryWatcher — p99 was ~22s serial at 50 entries.
 *
 * Returns the number of files actually written.
 */
async function writeRemoteEntriesToLocal(
  entries: Record<string, string>,
): Promise<number> {
  const results = await Promise.all(
    Object.entries(entries).map(async ([relPath, content]) => {
      let validatedPath: string
      try {
        validatedPath = await validateTeamMemKey(relPath)
      } catch (e) {
        if (e instanceof PathTraversalError) {
          logForDebugging(`team-memory-sync: ${e.message}`, { level: 'warn' })
          return false
        }
        throw e
      }

      const sizeBytes = Buffer.byteLength(content, 'utf8')
      if (sizeBytes > MAX_FILE_SIZE_BYTES) {
        logForDebugging(
          `team-memory-sync: skipping oversized remote entry "${relPath}"`,
          { level: 'info' },
        )
        return false
      }

      // Skip if on-disk content already matches. Handles the common case
      // where pull returns unchanged entries (skipEtagCache path, first
      // pull of a session with warm disk state from prior session).
      try {
        const existing = await readFile(validatedPath, 'utf8')
        if (existing === content) {
          return false
        }
      } catch (e) {
        if (
          isErrnoException(e) &&
          e.code !== 'ENOENT' &&
          e.code !== 'ENOTDIR'
        ) {
          logForDebugging(
            `team-memory-sync: unexpected read error for "${relPath}": ${e.code}`,
            { level: 'debug' },
          )
        }
        // Fall through to write for ENOENT/ENOTDIR (file doesn't exist yet)
      }

      try {
        const parentDir = validatedPath.substring(
          0,
          validatedPath.lastIndexOf(sep),
        )
        await mkdir(parentDir, { recursive: true })
        await writeFile(validatedPath, content, 'utf8')
        return true
      } catch (e) {
        logForDebugging(
          `team-memory-sync: failed to write "${relPath}": ${e}`,
          { level: 'warn' },
        )
        return false
      }
    }),
  )

  return count(results, Boolean)
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Check if team memory sync is available (requires first-party OAuth).
 */
export function isTeamMemorySyncAvailable(): boolean {
  return isUsingOAuth()
}

/**
 * Pull team memory from the server and write to local directory.
 * Returns true if any files were updated.
 */
export async function pullTeamMemory(
  state: SyncState,
  options?: { skipEtagCache?: boolean },
): Promise<{
  success: boolean
  filesWritten: number
  /** Number of entries the server returned, regardless of whether they were written to disk. */
  entryCount: number
  notModified?: boolean
  error?: string
}> {
  const skipEtagCache = options?.skipEtagCache ?? false
  const startTime = Date.now()

  if (!isUsingOAuth()) {
    logPull(startTime, { success: false, errorType: 'no_oauth' })
    return {
      success: false,
      filesWritten: 0,
      entryCount: 0,
      error: 'OAuth not available',
    }
  }

  const repoSlug = await getGithubRepo()
  if (!repoSlug) {
    logPull(startTime, { success: false, errorType: 'no_repo' })
    return {
      success: false,
      filesWritten: 0,
      entryCount: 0,
      error: 'No git remote found',
    }
  }

  const etag = skipEtagCache ? null : state.lastKnownChecksum
  const result = await fetchTeamMemory(state, repoSlug, etag)
  if (!result.success) {
    logPull(startTime, {
      success: false,
      errorType: result.errorType,
      status: result.httpStatus,
    })
    return {
      success: false,
      filesWritten: 0,
      entryCount: 0,
      error: result.error,
    }
  }
  if (result.notModified) {
    logPull(startTime, { success: true, notModified: true })
    return { success: true, filesWritten: 0, entryCount: 0, notModified: true }
  }
  if (result.isEmpty || !result.data) {
    // Server has no data — clear stale serverChecksums so the next push
    // doesn't skip entries it thinks the server already has.
    state.serverChecksums.clear()
    logPull(startTime, { success: true })
    return { success: true, filesWritten: 0, entryCount: 0 }
  }

  const entries = result.data.content.entries
  const responseChecksums = result.data.content.entryChecksums

  // Refresh serverChecksums from server-provided per-key hashes.
  // Requires anthropic/anthropic#283027 — if the response lacks entryChecksums
  // (pre-deploy server), serverChecksums stays empty and the next push uploads
  // everything; it self-corrects on push success.
  state.serverChecksums.clear()
  if (responseChecksums) {
    for (const [key, hash] of Object.entries(responseChecksums)) {
      state.serverChecksums.set(key, hash)
    }
  } else {
    logForDebugging(
      'team-memory-sync: server response missing entryChecksums (pre-#283027 deploy) — next push will be full, not delta',
      { level: 'debug' },
    )
  }

  const filesWritten = await writeRemoteEntriesToLocal(entries)
  if (filesWritten > 0) {
    const { clearMemoryFileCaches } = await import('../../utils/claudemd.js')
    clearMemoryFileCaches()
  }
  logForDebugging(`team-memory-sync: pulled ${filesWritten} files`, {
    level: 'info',
  })

  logPull(startTime, { success: true, filesWritten })

  return {
    success: true,
    filesWritten,
    entryCount: Object.keys(entries).length,
  }
}

/**
 * Push local team memory files to the server with optimistic locking.
 *
 * Uses delta upload: only keys whose local content hash differs from
 * serverChecksums are included in the PUT. On 412 conflict, probes
 * GET ?view=hashes to refresh serverChecksums, recomputes the delta
 * (naturally excluding keys where a teammate's push matches ours),
 * and retries. No merge, no disk writes — server-only new keys from
 * a teammate's concurrent push propagate on the next pull.
 *
 * Local-wins-on-conflict is the opposite of syncTeamMemory's pull-first
 * semantics. This is intentional: pushTeamMemory is triggered by a local edit,
 * and that edit must not be silently discarded just because a teammate pushed
 * in the meantime. Content-level merge (same key, both changed) is not
 * attempted — the local version simply overwrites the server version for that
 * key, and the server's edit to that key is lost. This is the lesser evil:
 * the local user is actively editing and can re-incorporate the teammate's
 * changes, whereas silently discarding the local edit loses work the user
 * just did with no recourse.
 */
export async function pushTeamMemory(
  state: SyncState,
): Promise<TeamMemorySyncPushResult> {
  const startTime = Date.now()
  let conflictRetries = 0

  if (!isUsingOAuth()) {
    logPush(startTime, { success: false, errorType: 'no_oauth' })
    return {
      success: false,
      filesUploaded: 0,
      error: 'OAuth not available',
      errorType: 'no_oauth',
    }
  }

  const repoSlug = await getGithubRepo()
  if (!repoSlug) {
    logPush(startTime, { success: false, errorType: 'no_repo' })
    return {
      success: false,
      filesUploaded: 0,
      error: 'No git remote found',
      errorType: 'no_repo',
    }
  }

  // Read local entries once at the start. Conflict resolution does NOT re-read
  // from disk — the delta computation against a refreshed serverChecksums naturally
  // excludes server-origin content, so the user's local edit cannot be clobbered.
  // Secret scanning (PSR M22174) happens here once — files with detected
  // secrets are excluded from the upload set.
  const localRead = await readLocalTeamMemory(state.serverMaxEntries)
  const entries = localRead.entries
  const skippedSecrets = localRead.skippedSecrets
  if (skippedSecrets.length > 0) {
    // Log a user-visible warning listing which files were skipped and why.
    // Don't block the push — just exclude those files. The secret VALUE is
    // never logged, only the type label.
    const summary = skippedSecrets
      .map(s => `"${s.path}" (${s.label})`)
      .join(', ')
    logForDebugging(
      `team-memory-sync: ${skippedSecrets.length} file(s) skipped due to detected secrets: ${summary}. Remove the secret(s) to enable sync for these files.`,
      { level: 'warn' },
    )
    logEvent('tengu_team_mem_secret_skipped', {
      file_count: skippedSecrets.length,
      // Only log gitleaks rule IDs (not values, not paths — paths could
      // leak repo structure). Comma-joined for compact single-field analytics.
      rule_ids: skippedSecrets
        .map(s => s.ruleId)
        .join(
          ',',
        ) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
  }

  // Hash each local entry once. The loop recomputes the delta each iteration
  // (serverChecksums may change after a 412 probe) but local hashes are stable.
  const localHashes = new Map<string, string>()
  for (const [key, content] of Object.entries(entries)) {
    localHashes.set(key, hashContent(content))
  }

  let sawConflict = false

  for (
    let conflictAttempt = 0;
    conflictAttempt <= MAX_CONFLICT_RETRIES;
    conflictAttempt++
  ) {
    // Delta: only upload keys whose content hash differs from what we believe
    // the server holds. On first push after a fresh pull, this is exactly the
    // user's local edits. After a 412 probe, matching hashes are excluded —
    // server-origin content from a teammate's concurrent push is naturally
    // dropped from the delta, so we never re-upload it.
    const delta: Record<string, string> = {}
    for (const [key, localHash] of localHashes) {
      if (state.serverChecksums.get(key) !== localHash) {
        delta[key] = entries[key]!
      }
    }
    const deltaCount = Object.keys(delta).length

    if (deltaCount === 0) {
      // Nothing to upload. This is the expected fast path after a fresh pull
      // with no local edits, and also the convergence point after a 412 where
      // the teammate's push was a strict superset of ours.
      logPush(startTime, {
        success: true,
        conflict: sawConflict,
        conflictRetries,
      })
      return {
        success: true,
        filesUploaded: 0,
        ...(skippedSecrets.length > 0 && { skippedSecrets }),
      }
    }

    // Split the delta into PUT-sized batches to stay under the gateway's
    // body-size limit.  Typical deltas (1-3 edited files) land in one batch;
    // cold pushes with many files are where this earns its keep.  Each batch
    // is a complete PUT that upserts its keys independently — if batch N
    // fails, batches 1..N-1 are already committed server-side.  Updating
    // serverChecksums after each success means the outer conflict-loop retry
    // naturally resumes from the uncommitted tail (those keys still differ).
    // state.lastKnownChecksum is updated inside uploadTeamMemory on each
    // 200, so the ETag chain threads through the batches automatically.
    const batches = batchDeltaByBytes(delta)
    let filesUploaded = 0
    let result: TeamMemorySyncUploadResult | undefined

    for (const batch of batches) {
      result = await uploadTeamMemory(
        state,
        repoSlug,
        batch,
        state.lastKnownChecksum,
      )
      if (!result.success) break

      for (const key of Object.keys(batch)) {
        state.serverChecksums.set(key, localHashes.get(key)!)
      }
      filesUploaded += Object.keys(batch).length
    }
    // batches is non-empty (deltaCount > 0 guaranteed by the check above),
    // so the loop executed at least once.
    result = result!

    if (result.success) {
      // Server-side delta propagation to disk (server-only new keys from a
      // teammate's concurrent push) happens on the next pull — we only
      // fetched hashes during conflict resolution, not bodies.
      logForDebugging(
        batches.length > 1
          ? `team-memory-sync: pushed ${filesUploaded} of ${localHashes.size} files in ${batches.length} batches`
          : `team-memory-sync: pushed ${filesUploaded} of ${localHashes.size} files (delta)`,
        { level: 'info' },
      )
      logPush(startTime, {
        success: true,
        filesUploaded,
        conflict: sawConflict,
        conflictRetries,
        putBatches: batches.length > 1 ? batches.length : undefined,
      })
      return {
        success: true,
        filesUploaded,
        checksum: result.checksum,
        ...(skippedSecrets.length > 0 && { skippedSecrets }),
      }
    }

    if (!result.conflict) {
      // If the server returned a structured 413 with its effective
      // max_entries (anthropic/anthropic#293258), cache it so the next push
      // trims to the right cap. The server may GB-tune this per-org.
      // This push still fails — re-trimming mid-push would require re-reading
      // local entries and re-computing the delta, and we'd need
      // soft_delete_keys to shrink below current server count anyway.
      if (result.serverMaxEntries !== undefined) {
        state.serverMaxEntries = result.serverMaxEntries
        logForDebugging(
          `team-memory-sync: learned server max_entries=${result.serverMaxEntries} from 413; next push will truncate to this`,
          { level: 'warn' },
        )
      }
      // filesUploaded may be nonzero if earlier batches committed before this
      // one failed. Those keys ARE on the server; the push is a failure
      // because it's incomplete, but we don't re-upload them on retry
      // (serverChecksums was updated).
      logPush(startTime, {
        success: false,
        filesUploaded,
        conflictRetries,
        putBatches: batches.length > 1 ? batches.length : undefined,
        errorType: result.errorType,
        status: result.httpStatus,
        // Datadog: filter @error_code:team_memory_too_many_entries to track
        // too-many-files rejections distinct from gateway/unstructured 413s
        errorCode: result.serverErrorCode,
        serverMaxEntries: result.serverMaxEntries,
        serverReceivedEntries: result.serverReceivedEntries,
      })
      return {
        success: false,
        filesUploaded,
        error: result.error,
        errorType: result.errorType,
        httpStatus: result.httpStatus,
      }
    }

    // 412 conflict — refresh serverChecksums and retry with a tighter delta.
    sawConflict = true
    if (conflictAttempt >= MAX_CONFLICT_RETRIES) {
      logForDebugging(
        `team-memory-sync: giving up after ${MAX_CONFLICT_RETRIES} conflict retries`,
        { level: 'warn' },
      )
      logPush(startTime, {
        success: false,
        conflict: true,
        conflictRetries,
        errorType: 'conflict',
      })
      return {
        success: false,
        filesUploaded: 0,
        conflict: true,
        error: 'Conflict resolution failed after retries',
      }
    }

    conflictRetries++

    logForDebugging(
      `team-memory-sync: conflict (412), probing server hashes (attempt ${conflictAttempt + 1}/${MAX_CONFLICT_RETRIES})`,
      { level: 'info' },
    )

    // Cheap probe: fetch only per-key checksums, no entry bodies. Refreshes
    // serverChecksums so the next iteration's delta drops any keys a teammate just
    // pushed with identical content.
    const probe = await fetchTeamMemoryHashes(state, repoSlug)
    if (!probe.success || !probe.entryChecksums) {
      // Requires anthropic/anthropic#283027. A transient probe failure here is
      // fine: the push is failed and the watcher will retry on the next edit.
      logPush(startTime, {
        success: false,
        conflict: true,
        conflictRetries,
        errorType: 'conflict',
      })
      return {
        success: false,
        filesUploaded: 0,
        conflict: true,
        error: `Conflict resolution hashes probe failed: ${probe.error}`,
      }
    }
    state.serverChecksums.clear()
    for (const [key, hash] of Object.entries(probe.entryChecksums)) {
      state.serverChecksums.set(key, hash)
    }
  }

  logPush(startTime, { success: false, conflictRetries })
  return {
    success: false,
    filesUploaded: 0,
    error: 'Unexpected end of conflict resolution loop',
  }
}

/**
 * Bidirectional sync: pull from server, merge with local, push back.
 * Server entries take precedence on conflict (last-write-wins by the server).
 * Push uses conflict resolution (retries on 412) via pushTeamMemory.
 */
export async function syncTeamMemory(state: SyncState): Promise<{
  success: boolean
  filesPulled: number
  filesPushed: number
  error?: string
}> {
  // 1. Pull remote → local (skip ETag cache for full sync)
  const pullResult = await pullTeamMemory(state, { skipEtagCache: true })
  if (!pullResult.success) {
    return {
      success: false,
      filesPulled: 0,
      filesPushed: 0,
      error: pullResult.error,
    }
  }

  // 2. Push local → remote (with conflict resolution)
  const pushResult = await pushTeamMemory(state)
  if (!pushResult.success) {
    return {
      success: false,
      filesPulled: pullResult.filesWritten,
      filesPushed: 0,
      error: pushResult.error,
    }
  }

  logForDebugging(
    `team-memory-sync: synced (pulled ${pullResult.filesWritten}, pushed ${pushResult.filesUploaded})`,
    { level: 'info' },
  )

  return {
    success: true,
    filesPulled: pullResult.filesWritten,
    filesPushed: pushResult.filesUploaded,
  }
}

// ─── Telemetry helpers ───────────────────────────────────────

function logPull(
  startTime: number,
  outcome: {
    success: boolean
    filesWritten?: number
    notModified?: boolean
    errorType?: string
    status?: number
  },
): void {
  logEvent('tengu_team_mem_sync_pull', {
    success: outcome.success,
    files_written: outcome.filesWritten ?? 0,
    not_modified: outcome.notModified ?? false,
    duration_ms: Date.now() - startTime,
    ...(outcome.errorType && {
      errorType:
        outcome.errorType as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    }),
    ...(outcome.status && { status: outcome.status }),
  })
}

function logPush(
  startTime: number,
  outcome: {
    success: boolean
    filesUploaded?: number
    conflict?: boolean
    conflictRetries?: number
    errorType?: string
    status?: number
    putBatches?: number
    errorCode?: string
    serverMaxEntries?: number
    serverReceivedEntries?: number
  },
): void {
  logEvent('tengu_team_mem_sync_push', {
    success: outcome.success,
    files_uploaded: outcome.filesUploaded ?? 0,
    conflict: outcome.conflict ?? false,
    conflict_retries: outcome.conflictRetries ?? 0,
    duration_ms: Date.now() - startTime,
    ...(outcome.errorType && {
      errorType:
        outcome.errorType as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    }),
    ...(outcome.status && { status: outcome.status }),
    ...(outcome.putBatches && { put_batches: outcome.putBatches }),
    ...(outcome.errorCode && {
      error_code:
        outcome.errorCode as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    }),
    ...(outcome.serverMaxEntries !== undefined && {
      server_max_entries: outcome.serverMaxEntries,
    }),
    ...(outcome.serverReceivedEntries !== undefined && {
      server_received_entries: outcome.serverReceivedEntries,
    }),
  })
}
