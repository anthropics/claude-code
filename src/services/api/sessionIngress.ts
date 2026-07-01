import axios, { type AxiosError } from 'axios'
import type { UUID } from 'crypto'
import { getOauthConfig } from '../../constants/oauth.js'
import type { Entry, TranscriptMessage } from '../../types/logs.js'
import { logForDebugging } from '../../utils/debug.js'
import { logForDiagnosticsNoPII } from '../../utils/diagLogs.js'
import { isEnvTruthy } from '../../utils/envUtils.js'
import { logError } from '../../utils/log.js'
import { sequential } from '../../utils/sequential.js'
import { getSessionIngressAuthToken } from '../../utils/sessionIngressAuth.js'
import { sleep } from '../../utils/sleep.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import { getOAuthHeaders } from '../../utils/teleport/api.js'

interface SessionIngressError {
  error?: {
    message?: string
    type?: string
  }
}

// Module-level state
const lastUuidMap: Map<string, UUID> = new Map()

const MAX_RETRIES = 10
const BASE_DELAY_MS = 500

// Per-session sequential wrappers to prevent concurrent log writes
const sequentialAppendBySession: Map<
  string,
  (
    entry: TranscriptMessage,
    url: string,
    headers: Record<string, string>,
  ) => Promise<boolean>
> = new Map()

/**
 * Gets or creates a sequential wrapper for a session
 * This ensures that log appends for a session are processed one at a time
 */
function getOrCreateSequentialAppend(sessionId: string) {
  let sequentialAppend = sequentialAppendBySession.get(sessionId)
  if (!sequentialAppend) {
    sequentialAppend = sequential(
      async (
        entry: TranscriptMessage,
        url: string,
        headers: Record<string, string>,
      ) => await appendSessionLogImpl(sessionId, entry, url, headers),
    )
    sequentialAppendBySession.set(sessionId, sequentialAppend)
  }
  return sequentialAppend
}

/**
 * Internal implementation of appendSessionLog with retry logic
 * Retries on transient errors (network, 5xx, 429). On 409, adopts the server's
 * last UUID and retries (handles stale state from killed process's in-flight
 * requests). Fails immediately on 401.
 */
async function appendSessionLogImpl(
  sessionId: string,
  entry: TranscriptMessage,
  url: string,
  headers: Record<string, string>,
): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const lastUuid = lastUuidMap.get(sessionId)
      const requestHeaders = { ...headers }
      if (lastUuid) {
        requestHeaders['Last-Uuid'] = lastUuid
      }

      const response = await axios.put(url, entry, {
        headers: requestHeaders,
        validateStatus: status => status < 500,
      })

      if (response.status === 200 || response.status === 201) {
        lastUuidMap.set(sessionId, entry.uuid)
        logForDebugging(
          `Successfully persisted session log entry for session ${sessionId}`,
        )
        return true
      }

      if (response.status === 409) {
        // Check if our entry was actually stored (server returned 409 but entry exists)
        // This handles the scenario where entry was stored but client received an error
        // response, causing lastUuidMap to be stale
        const serverLastUuid = response.headers['x-last-uuid']
        if (serverLastUuid === entry.uuid) {
          // Our entry IS the last entry on server - it was stored successfully previously
          lastUuidMap.set(sessionId, entry.uuid)
          logForDebugging(
            `Session entry ${entry.uuid} already present on server, recovering from stale state`,
          )
          logForDiagnosticsNoPII('info', 'session_persist_recovered_from_409')
          return true
        }

        // Another writer (e.g. in-flight request from a killed process)
        // advanced the server's chain. Try to adopt the server's last UUID
        // from the response header, or re-fetch the session to discover it.
        if (serverLastUuid) {
          lastUuidMap.set(sessionId, serverLastUuid as UUID)
          logForDebugging(
            `Session 409: adopting server lastUuid=${serverLastUuid} from header, retrying entry ${entry.uuid}`,
          )
        } else {
          // Server didn't return x-last-uuid (e.g. v1 endpoint). Re-fetch
          // the session to discover the current head of the append chain.
          const logs = await fetchSessionLogsFromUrl(sessionId, url, headers)
          const adoptedUuid = findLastUuid(logs)
          if (adoptedUuid) {
            lastUuidMap.set(sessionId, adoptedUuid)
            logForDebugging(
              `Session 409: re-fetched ${logs!.length} entries, adopting lastUuid=${adoptedUuid}, retrying entry ${entry.uuid}`,
            )
          } else {
            // Can't determine server state — give up
            const errorData = response.data as SessionIngressError
            const errorMessage =
              errorData.error?.message || 'Concurrent modification detected'
            logError(
              new Error(
                `Session persistence conflict: UUID mismatch for session ${sessionId}, entry ${entry.uuid}. ${errorMessage}`,
              ),
            )
            logForDiagnosticsNoPII(
              'error',
              'session_persist_fail_concurrent_modification',
            )
            return false
          }
        }
        logForDiagnosticsNoPII('info', 'session_persist_409_adopt_server_uuid')
        continue // retry with updated lastUuid
      }

      if (response.status === 401) {
        logForDebugging('Session token expired or invalid')
        logForDiagnosticsNoPII('error', 'session_persist_fail_bad_token')
        return false // Non-retryable
      }

      // Other 4xx (429, etc.) - retryable
      logForDebugging(
        `Failed to persist session log: ${response.status} ${response.statusText}`,
      )
      logForDiagnosticsNoPII('error', 'session_persist_fail_status', {
        status: response.status,
        attempt,
      })
    } catch (error) {
      // Network errors, 5xx - retryable
      const axiosError = error as AxiosError<SessionIngressError>
      logError(new Error(`Error persisting session log: ${axiosError.message}`))
      logForDiagnosticsNoPII('error', 'session_persist_fail_status', {
        status: axiosError.status,
        attempt,
      })
    }

    if (attempt === MAX_RETRIES) {
      logForDebugging(`Remote persistence failed after ${MAX_RETRIES} attempts`)
      logForDiagnosticsNoPII(
        'error',
        'session_persist_error_retries_exhausted',
        { attempt },
      )
      return false
    }

    const delayMs = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), 8000)
    logForDebugging(
      `Remote persistence attempt ${attempt}/${MAX_RETRIES} failed, retrying in ${delayMs}ms…`,
    )
    await sleep(delayMs)
  }

  return false
}

/**
 * Append a log entry to the session using JWT token
 * Uses optimistic concurrency control with Last-Uuid header
 * Ensures sequential execution per session to prevent race conditions
 */
export async function appendSessionLog(
  sessionId: string,
  entry: TranscriptMessage,
  url: string,
): Promise<boolean> {
  const sessionToken = getSessionIngressAuthToken()
  if (!sessionToken) {
    logForDebugging('No session token available for session persistence')
    logForDiagnosticsNoPII('error', 'session_persist_fail_jwt_no_token')
    return false
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${sessionToken}`,
    'Content-Type': 'application/json',
  }

  const sequentialAppend = getOrCreateSequentialAppend(sessionId)
  return sequentialAppend(entry, url, headers)
}

/**
 * Get all session logs for hydration
 */
export async function getSessionLogs(
  sessionId: string,
  url: string,
): Promise<Entry[] | null> {
  const sessionToken = getSessionIngressAuthToken()
  if (!sessionToken) {
    logForDebugging('No session token available for fetching session logs')
    logForDiagnosticsNoPII('error', 'session_get_fail_no_token')
    return null
  }

  const headers = { Authorization: `Bearer ${sessionToken}` }
  const logs = await fetchSessionLogsFromUrl(sessionId, url, headers)

  if (logs && logs.length > 0) {
    // Update our lastUuid to the last entry's UUID
    const lastEntry = logs.at(-1)
    if (lastEntry && 'uuid' in lastEntry && lastEntry.uuid) {
      lastUuidMap.set(sessionId, lastEntry.uuid)
    }
  }

  return logs
}

/**
 * Get all session logs for hydration via OAuth
 * Used for teleporting sessions from the Sessions API
 */
export async function getSessionLogsViaOAuth(
  sessionId: string,
  accessToken: string,
  orgUUID: string,
): Promise<Entry[] | null> {
  const url = `${getOauthConfig().BASE_API_URL}/v1/session_ingress/session/${sessionId}`
  logForDebugging(`[session-ingress] Fetching session logs from: ${url}`)
  const headers = {
    ...getOAuthHeaders(accessToken),
    'x-organization-uuid': orgUUID,
  }
  const result = await fetchSessionLogsFromUrl(sessionId, url, headers)
  return result
}

/**
 * Response shape from GET /v1/code/sessions/{id}/teleport-events.
 * WorkerEvent.payload IS the Entry (TranscriptMessage struct) — the CLI
 * writes it via AddWorkerEvent, the server stores it opaque, we read it
 * back here.
 */
type TeleportEventsResponse = {
  data: Array<{
    event_id: string
    event_type: string
    is_compaction: boolean
    payload: Entry | null
    created_at: string
  }>
  // Unset when there are no more pages — this IS the end-of-stream
  // signal (no separate has_more field).
  next_cursor?: string
}

/**
 * Get worker events (transcript) via the CCR v2 Sessions API. Replaces
 * getSessionLogsViaOAuth once session-ingress is retired.
 *
 * The server dispatches per-session: Spanner for v2-native sessions,
 * threadstore for pre-backfill session_* IDs. The cursor is opaque to us —
 * echo it back until next_cursor is unset.
 *
 * Paginated (500/page default, server max 1000). session-ingress's one-shot
 * 50k is gone; we loop.
 */
export async function getTeleportEvents(
  sessionId: string,
  accessToken: string,
  orgUUID: string,
): Promise<Entry[] | null> {
  const baseUrl = `${getOauthConfig().BASE_API_URL}/v1/code/sessions/${sessionId}/teleport-events`
  const headers = {
    ...getOAuthHeaders(accessToken),
    'x-organization-uuid': orgUUID,
  }

  logForDebugging(`[teleport] Fetching events from: ${baseUrl}`)

  const all: Entry[] = []
  let cursor: string | undefined
  let pages = 0

  // Infinite-loop guard: 1000/page × 100 pages = 100k events. Larger than
  // session-ingress's 50k one-shot. If we hit this, something's wrong
  // (server not advancing cursor) — bail rather than hang.
  const maxPages = 100

  while (pages < maxPages) {
    const params: Record<string, string | number> = { limit: 1000 }
    if (cursor !== undefined) {
      params.cursor = cursor
    }

    let response
    try {
      response = await axios.get<TeleportEventsResponse>(baseUrl, {
        headers,
        params,
        timeout: 20000,
        validateStatus: status => status < 500,
      })
    } catch (e) {
      const err = e as AxiosError
      logError(new Error(`Teleport events fetch failed: ${err.message}`))
      logForDiagnosticsNoPII('error', 'teleport_events_fetch_fail')
      return null
    }

    if (response.status === 404) {
      // 404 on page 0 is ambiguous during the migration window:
      //   (a) Session genuinely not found (not in Spanner AND not in
      //       threadstore) — nothing to fetch.
      //   (b) Route-level 404: endpoint not deployed yet, or session is
      //       a threadstore session not yet backfilled into Spanner.
      // We can't tell them apart from the response alone. Returning null
      // lets the caller fall back to session-ingress, which will correctly
      // return empty for case (a) and data for case (b). Once the backfill
      // is complete and session-ingress is gone, the fallback also returns
      // null → same "Failed to fetch session logs" error as today.
      //
      // 404 mid-pagination (pages > 0) means session was deleted between
      // pages — return what we have.
      logForDebugging(
        `[teleport] Session ${sessionId} not found (page ${pages})`,
      )
      logForDiagnosticsNoPII('warn', 'teleport_events_not_found')
      return pages === 0 ? null : all
    }

    if (response.status === 401) {
      logForDiagnosticsNoPII('error', 'teleport_events_bad_token')
      throw new Error(
        'Your session has expired. Please run /login to sign in again.',
      )
    }

    if (response.status !== 200) {
      logError(
        new Error(
          `Teleport events returned ${response.status}: ${jsonStringify(response.data)}`,
        ),
      )
      logForDiagnosticsNoPII('error', 'teleport_events_bad_status')
      return null
    }

    const { data, next_cursor } = response.data
    if (!Array.isArray(data)) {
      logError(
        new Error(
          `Teleport events invalid response shape: ${jsonStringify(response.data)}`,
        ),
      )
      logForDiagnosticsNoPII('error', 'teleport_events_invalid_shape')
      return null
    }

    // payload IS the Entry. null payload happens for threadstore non-generic
    // events (server skips them) or encryption failures — skip here too.
    for (const ev of data) {
      if (ev.payload !== null) {
        all.push(ev.payload)
      }
    }

    pages++
    // == null covers both `null` and `undefined` — the proto omits the
    // field at end-of-stream, but some serializers emit `null`. Strict
    // `=== undefined` would loop forever on `null` (cursor=null in query
    // params stringifies to "null", which the server rejects or echoes).
    if (next_cursor == null) {
      break
    }
    cursor = next_cursor
  }

  if (pages >= maxPages) {
    // Don't fail — return what we have. Better to teleport with a
    // truncated transcript than not at all.
    logError(
      new Error(`Teleport events hit page cap (${maxPages}) for ${sessionId}`),
    )
    logForDiagnosticsNoPII('warn', 'teleport_events_page_cap')
  }

  logForDebugging(
    `[teleport] Fetched ${all.length} events over ${pages} page(s) for ${sessionId}`,
  )
  return all
}

/**
 * Shared implementation for fetching session logs from a URL
 */
async function fetchSessionLogsFromUrl(
  sessionId: string,
  url: string,
  headers: Record<string, string>,
): Promise<Entry[] | null> {
  try {
    const response = await axios.get(url, {
      headers,
      timeout: 20000,
      validateStatus: status => status < 500,
      params: isEnvTruthy(process.env.CLAUDE_AFTER_LAST_COMPACT)
        ? { after_last_compact: true }
        : undefined,
    })

    if (response.status === 200) {
      const data = response.data

      // Validate the response structure
      if (!data || typeof data !== 'object' || !Array.isArray(data.loglines)) {
        logError(
          new Error(
            `Invalid session logs response format: ${jsonStringify(data)}`,
          ),
        )
        logForDiagnosticsNoPII('error', 'session_get_fail_invalid_response')
        return null
      }

      const logs = data.loglines as Entry[]
      logForDebugging(
        `Fetched ${logs.length} session logs for session ${sessionId}`,
      )
      return logs
    }

    if (response.status === 404) {
      logForDebugging(`No existing logs for session ${sessionId}`)
      logForDiagnosticsNoPII('warn', 'session_get_no_logs_for_session')
      return []
    }

    if (response.status === 401) {
      logForDebugging('Auth token expired or invalid')
      logForDiagnosticsNoPII('error', 'session_get_fail_bad_token')
      throw new Error(
        'Your session has expired. Please run /login to sign in again.',
      )
    }

    logForDebugging(
      `Failed to fetch session logs: ${response.status} ${response.statusText}`,
    )
    logForDiagnosticsNoPII('error', 'session_get_fail_status', {
      status: response.status,
    })
    return null
  } catch (error) {
    const axiosError = error as AxiosError<SessionIngressError>
    logError(new Error(`Error fetching session logs: ${axiosError.message}`))
    logForDiagnosticsNoPII('error', 'session_get_fail_status', {
      status: axiosError.status,
    })
    return null
  }
}

/**
 * Walk backward through entries to find the last one with a uuid.
 * Some entry types (SummaryMessage, TagMessage) don't have one.
 */
function findLastUuid(logs: Entry[] | null): UUID | undefined {
  if (!logs) {
    return undefined
  }
  const entry = logs.findLast(e => 'uuid' in e && e.uuid)
  return entry && 'uuid' in entry ? (entry.uuid as UUID) : undefined
}

/**
 * Clear cached state for a session
 */
export function clearSession(sessionId: string): void {
  lastUuidMap.delete(sessionId)
  sequentialAppendBySession.delete(sessionId)
}

/**
 * Clear all cached session state (all sessions).
 * Use this on /clear to free sub-agent session entries.
 */
export function clearAllSessions(): void {
  lastUuidMap.clear()
  sequentialAppendBySession.clear()
}
