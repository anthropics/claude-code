/**
 * Team Memory Sync Types
 *
 * Zod schemas and types for the repo-scoped team memory sync API.
 * Based on the backend API contract from anthropic/anthropic#250711.
 */

import { z } from 'zod/v4'
import { lazySchema } from '../../utils/lazySchema.js'

/**
 * Content portion of team memory data - flat key-value storage.
 * Keys are file paths relative to the team memory directory (e.g. "MEMORY.md", "patterns.md").
 * Values are UTF-8 string content (typically Markdown).
 */
export const TeamMemoryContentSchema = lazySchema(() =>
  z.object({
    entries: z.record(z.string(), z.string()),
    // Per-key SHA-256 of entry content (`sha256:<hex>`). Added in
    // anthropic/anthropic#283027. Optional for forward-compat with older
    // server deployments; empty map when entries is empty.
    entryChecksums: z.record(z.string(), z.string()).optional(),
  }),
)

/**
 * Full response from GET /api/claude_code/team_memory
 */
export const TeamMemoryDataSchema = lazySchema(() =>
  z.object({
    organizationId: z.string(),
    repo: z.string(),
    version: z.number(),
    lastModified: z.string(), // ISO 8601 timestamp
    checksum: z.string(), // SHA256 with 'sha256:' prefix
    content: TeamMemoryContentSchema(),
  }),
)

/**
 * Structured 413 error body from the server (anthropic/anthropic#293258).
 * The server's RequestTooLargeException serializes error_code and the
 * extra_details dict flattened into error.details. We only model the
 * too-many-entries case; entry-too-large is handled via MAX_FILE_SIZE_BYTES
 * pre-check on the client side and would need a separate schema.
 */
export const TeamMemoryTooManyEntriesSchema = lazySchema(() =>
  z.object({
    error: z.object({
      details: z.object({
        error_code: z.literal('team_memory_too_many_entries'),
        max_entries: z.number().int().positive(),
        received_entries: z.number().int().positive(),
      }),
    }),
  }),
)

export type TeamMemoryData = z.infer<ReturnType<typeof TeamMemoryDataSchema>>

/**
 * A file skipped during push because it contains a detected secret.
 * The path is relative to the team memory directory. Only the matched
 * gitleaks rule ID is recorded — never the secret value itself.
 */
export type SkippedSecretFile = {
  path: string
  /** Gitleaks rule ID (e.g., "github-pat", "aws-access-token") */
  ruleId: string
  /** Human-readable label derived from rule ID */
  label: string
}

/**
 * Result from fetching team memory
 */
export type TeamMemorySyncFetchResult = {
  success: boolean
  data?: TeamMemoryData
  isEmpty?: boolean // true if 404 (no data exists)
  notModified?: boolean // true if 304 (ETag matched, no changes)
  checksum?: string // ETag from response header
  error?: string
  skipRetry?: boolean
  errorType?: 'auth' | 'timeout' | 'network' | 'parse' | 'unknown'
  httpStatus?: number
}

/**
 * Lightweight metadata-only probe result (GET ?view=hashes).
 * Contains per-key checksums without entry bodies. Used to refresh
 * serverChecksums cheaply during 412 conflict resolution.
 */
export type TeamMemoryHashesResult = {
  success: boolean
  version?: number
  checksum?: string
  entryChecksums?: Record<string, string>
  error?: string
  errorType?: 'auth' | 'timeout' | 'network' | 'parse' | 'unknown'
  httpStatus?: number
}

/**
 * Result from uploading team memory with conflict info
 */
export type TeamMemorySyncPushResult = {
  success: boolean
  filesUploaded: number
  checksum?: string
  conflict?: boolean // true if 412 Precondition Failed
  error?: string
  /** Files skipped because they contain detected secrets (PSR M22174). */
  skippedSecrets?: SkippedSecretFile[]
  errorType?:
    | 'auth'
    | 'timeout'
    | 'network'
    | 'conflict'
    | 'unknown'
    | 'no_oauth'
    | 'no_repo'
  httpStatus?: number
}

/**
 * Result from uploading team memory
 */
export type TeamMemorySyncUploadResult = {
  success: boolean
  checksum?: string
  lastModified?: string
  conflict?: boolean // true if 412 Precondition Failed
  error?: string
  errorType?: 'auth' | 'timeout' | 'network' | 'unknown'
  httpStatus?: number
  /**
   * Structured error_code from a parsed 413 body (anthropic/anthropic#293258).
   * Currently only 'team_memory_too_many_entries' is modelled; if the server
   * adds more (entry_too_large, total_bytes_exceeded) they'd extend this
   * union.  Passed straight through to the tengu_team_mem_sync_push event
   * as a Datadog-filterable facet.
   */
  serverErrorCode?: 'team_memory_too_many_entries'
  /**
   * Server-enforced max_entries, populated when serverErrorCode is
   * team_memory_too_many_entries. Lets the caller cache the effective
   * (possibly per-org) limit for subsequent pushes.
   */
  serverMaxEntries?: number
  /**
   * How many entries the rejected push would have produced after merge.
   * Populated alongside serverMaxEntries.
   */
  serverReceivedEntries?: number
}
