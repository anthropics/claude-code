/**
 * Filesystem cache for cloud-synced CLAUDE.md configuration.
 *
 * Responsibilities:
 * - Read/write/invalidate cache at ~/.claude/cache/cloud-config.json
 * - Atomic writes via temp-file-then-rename to prevent corruption
 * - File permissions locked to 0600 (owner read/write only)
 * - TTL validation with configurable duration
 * - Graceful handling of corrupt/missing cache (delete and recreate)
 * - Sync state management at ~/.claude/sync-state.json
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { homedir } from "node:os";

import type {
  CacheFile,
  CacheStatus,
  CloudConfigCache,
  CloudConfigOptions,
  ContentHash,
  SyncState,
} from "./cloud-config-types.js";
import {
  DEFAULT_CLOUD_CONFIG_OPTIONS,
  DEFAULT_SYNC_STATE,
  toContentHash,
} from "./cloud-config-types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_DIR_NAME = "cache";
const CACHE_FILE_NAME = "cloud-config.json";
const SYNC_STATE_FILE_NAME = "sync-state.json";
const SYNC_STATE_KEY_FILE_NAME = ".sync-state.hmac.key";
const SYNC_STATE_HMAC_FORMAT = "hmac-sha256-v1";

/** Owner read/write only -- no group or world access */
const FILE_MODE = 0o600;

/** Directory mode: owner read/write/execute */
const DIR_MODE = 0o700;

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

function resolveConfigDir(options: Partial<CloudConfigOptions>): string {
  if (options.configDir && options.configDir.length > 0) {
    return options.configDir;
  }

  const envOverride = process.env["CLAUDE_CONFIG_DIR"];
  if (envOverride && envOverride.length > 0) {
    return envOverride;
  }

  return path.join(homedir(), ".claude");
}

function getCachePath(configDir: string): string {
  return path.join(configDir, CACHE_DIR_NAME, CACHE_FILE_NAME);
}

function getSyncStatePath(configDir: string): string {
  return path.join(configDir, SYNC_STATE_FILE_NAME);
}

function getSyncStateKeyPath(configDir: string): string {
  return path.join(configDir, SYNC_STATE_KEY_FILE_NAME);
}

// ---------------------------------------------------------------------------
// Directory creation
// ---------------------------------------------------------------------------

async function ensureCacheDir(configDir: string): Promise<void> {
  const cacheDir = path.join(configDir, CACHE_DIR_NAME);
  await fs.mkdir(cacheDir, { recursive: true, mode: DIR_MODE });
}

// ---------------------------------------------------------------------------
// Cache file schema validation
// ---------------------------------------------------------------------------

/**
 * Validates the shape of a parsed JSON object against the CacheFile interface.
 * Returns the validated object or null if the shape is wrong. Avoids `any` by
 * accepting `unknown` and narrowing field-by-field.
 */
function validateCacheFile(data: unknown): CacheFile | null {
  if (data === null || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;

  if (typeof record["content"] !== "string") return null;
  if (typeof record["version"] !== "number") return null;
  if (typeof record["contentHash"] !== "string") return null;
  if (typeof record["etag"] !== "string") return null;
  if (typeof record["fetchedAt"] !== "number") return null;
  if (typeof record["updatedAt"] !== "string") return null;
  if (typeof record["updatedBy"] !== "string") return null;

  // All fields present and correctly typed -- safe to cast.
  // The branded types are opaque wrappers around primitives so this is sound.
  return record as unknown as CacheFile;
}

// ---------------------------------------------------------------------------
// Public API: Cache operations
// ---------------------------------------------------------------------------

/**
 * Reads the cloud config cache and returns a discriminated union describing
 * the result. Never throws -- corrupt or missing cache returns a typed status.
 */
export async function readCache(
  options: Partial<CloudConfigOptions> = {},
): Promise<CacheStatus> {
  const configDir = resolveConfigDir(options);
  const cachePath = getCachePath(configDir);

  let raw: string;
  try {
    raw = await fs.readFile(cachePath, "utf-8");
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === "ENOENT") {
      return { kind: "miss", reason: "no-file" };
    }
    // Permission errors or other I/O issues -- treat as corrupt
    return { kind: "corrupt", reason: describeError(err) };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Invalid JSON -- delete the corrupt file and report
    await deleteCacheFileSilently(cachePath);
    return { kind: "corrupt", reason: "invalid JSON" };
  }

  const cacheFile = validateCacheFile(parsed);
  if (cacheFile === null) {
    await deleteCacheFileSilently(cachePath);
    return { kind: "miss", reason: "invalid-schema" };
  }

  const ttlMs = options.cacheTtlMs ?? DEFAULT_CLOUD_CONFIG_OPTIONS.cacheTtlMs;
  const ageMs = Date.now() - cacheFile.fetchedAt;
  const isExpired = ageMs > ttlMs;

  const cache: CloudConfigCache = {
    data: cacheFile,
    isExpired,
    ageMs,
  };

  if (isExpired) {
    return { kind: "stale", cache };
  }

  return { kind: "hit", cache };
}

/**
 * Writes cache data atomically: write to a temp file in the same directory,
 * then rename. This prevents partial reads if the process crashes mid-write.
 */
export async function writeCache(
  cacheFile: CacheFile,
  options: Partial<CloudConfigOptions> = {},
): Promise<void> {
  const configDir = resolveConfigDir(options);
  const cachePath = getCachePath(configDir);
  const cacheDir = path.dirname(cachePath);

  // Temp file in the same directory so rename is atomic (same filesystem)
  const tmpName = `.cloud-config-${randomBytes(6).toString("hex")}.tmp`;
  const tmpPath = path.join(cacheDir, tmpName);

  const json = JSON.stringify(cacheFile, null, 2);

  try {
    await ensureCacheDir(configDir);
    await fs.writeFile(tmpPath, json, { encoding: "utf-8", mode: FILE_MODE });
    await fs.rename(tmpPath, cachePath);
  } catch (err: unknown) {
    // Best-effort cleanup of the temp file on failure
    await deleteCacheFileSilently(tmpPath);
    throw new CloudCacheWriteError(
      `Failed to write cache: ${describeError(err)}`,
      err,
    );
  }
}

/**
 * Removes the cache file. Idempotent -- does not throw if the file
 * is already missing.
 */
export async function invalidateCache(
  options: Partial<CloudConfigOptions> = {},
): Promise<void> {
  const configDir = resolveConfigDir(options);
  const cachePath = getCachePath(configDir);
  await deleteCacheFileSilently(cachePath);
}

// ---------------------------------------------------------------------------
// Public API: Sync state operations
// ---------------------------------------------------------------------------

/**
 * Reads the sync state file, returning the default state if the file is
 * missing or corrupt.
 */
export async function readSyncState(
  options: Partial<CloudConfigOptions> = {},
): Promise<SyncState> {
  const configDir = resolveConfigDir(options);
  const statePath = getSyncStatePath(configDir);

  let raw: string;
  try {
    raw = await fs.readFile(statePath, "utf-8");
  } catch {
    return { ...DEFAULT_SYNC_STATE };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Corrupt -- nuke and return defaults
    await deleteCacheFileSilently(statePath);
    return { ...DEFAULT_SYNC_STATE };
  }

  if (isSignedSyncStateFile(parsed)) {
    const key = await readSyncStateHmacKey(configDir);
    if (key === null) {
      await deleteCacheFileSilently(statePath);
      return { ...DEFAULT_SYNC_STATE };
    }

    const state = validateSyncState(parsed.state);
    if (state === null) {
      await deleteCacheFileSilently(statePath);
      return { ...DEFAULT_SYNC_STATE };
    }

    const expectedHmac = computeSyncStateHmac(state, key);
    if (!safeCompareHmac(parsed.hmac, expectedHmac)) {
      await deleteCacheFileSilently(statePath);
      return { ...DEFAULT_SYNC_STATE };
    }

    return state;
  }

  // Backwards-compatible migration: accept legacy unsigned files once,
  // then rewrite as signed state.
  const legacyState = validateSyncState(parsed);
  if (legacyState === null) {
    await deleteCacheFileSilently(statePath);
    return { ...DEFAULT_SYNC_STATE };
  }

  try {
    await writeSyncState(legacyState, options);
  } catch {
    // Non-fatal: return the validated legacy state even if migration fails.
  }
  return legacyState;
}

/**
 * Writes the sync state atomically (temp + rename), same pattern as the
 * cache file.
 */
export async function writeSyncState(
  state: SyncState,
  options: Partial<CloudConfigOptions> = {},
): Promise<void> {
  const configDir = resolveConfigDir(options);
  const statePath = getSyncStatePath(configDir);
  const tmpName = `.sync-state-${randomBytes(6).toString("hex")}.tmp`;
  const tmpPath = path.join(configDir, tmpName);

  try {
    // Sync state lives in the config root, not the cache subdir.
    await fs.mkdir(configDir, { recursive: true, mode: DIR_MODE });
    const key = await getOrCreateSyncStateHmacKey(configDir);
    const normalized = normalizeSyncState(state);
    const signedState: SignedSyncStateFile = {
      format: SYNC_STATE_HMAC_FORMAT,
      state: normalized,
      hmac: computeSyncStateHmac(normalized, key),
    };
    const json = JSON.stringify(signedState, null, 2);
    await fs.writeFile(tmpPath, json, { encoding: "utf-8", mode: FILE_MODE });
    await fs.rename(tmpPath, statePath);
  } catch (err: unknown) {
    await deleteCacheFileSilently(tmpPath);
    throw new CloudCacheWriteError(
      `Failed to write sync state: ${describeError(err)}`,
      err,
    );
  }
}

// ---------------------------------------------------------------------------
// Public API: Content hashing
// ---------------------------------------------------------------------------

/**
 * Computes a SHA-256 hex digest of the given content string.
 * Used to compare local vs. remote content without transferring the full body.
 */
export function computeContentHash(content: string): ContentHash {
  const hash = createHash("sha256").update(content, "utf-8").digest("hex");
  return toContentHash(hash);
}

// ---------------------------------------------------------------------------
// Public API: Path accessors (for testing and diagnostics)
// ---------------------------------------------------------------------------

export function getCacheFilePath(
  options: Partial<CloudConfigOptions> = {},
): string {
  return getCachePath(resolveConfigDir(options));
}

export function getSyncStateFilePath(
  options: Partial<CloudConfigOptions> = {},
): string {
  return getSyncStatePath(resolveConfigDir(options));
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class CloudCacheWriteError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "CloudCacheWriteError";
    this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------

/** Deletes a file, swallowing ENOENT (already gone) and other errors. */
async function deleteCacheFileSilently(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // Intentionally swallowed -- caller does not care if removal fails
  }
}

/**
 * Validates parsed JSON against the SyncState shape.
 * Returns null if validation fails.
 */
function validateSyncState(data: unknown): SyncState | null {
  if (data === null || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;

  if (typeof record["enabled"] !== "boolean") return null;

  // Nullable fields: version, timestamps, etag, hash
  if (!isNullableNumber(record["lastSyncedVersion"])) return null;
  if (!isNullableNumber(record["lastSyncedAt"])) return null;
  if (!isNullableString(record["lastSyncedEtag"])) return null;
  if (!isNullableString(record["lastSyncedContentHash"])) return null;

  if (typeof record["pendingPush"] !== "boolean") return null;
  if (!isNullableNumber(record["pendingPushSince"])) return null;

  if (!isOptionalNullableString(record["pendingReviewHash"])) return null;
  if (!isOptionalNullableNumber(record["pendingReviewVersion"])) return null;
  if (!isOptionalNullableNumber(record["pendingReviewSince"])) return null;

  return normalizeSyncState({
    enabled: record["enabled"] as boolean,
    lastSyncedVersion: record["lastSyncedVersion"] as SyncState["lastSyncedVersion"],
    lastSyncedAt: record["lastSyncedAt"] as SyncState["lastSyncedAt"],
    lastSyncedEtag: record["lastSyncedEtag"] as SyncState["lastSyncedEtag"],
    lastSyncedContentHash: record["lastSyncedContentHash"] as SyncState["lastSyncedContentHash"],
    pendingPush: record["pendingPush"] as boolean,
    pendingPushSince: record["pendingPushSince"] as SyncState["pendingPushSince"],
    pendingReviewHash: (record["pendingReviewHash"] ?? null) as SyncState["pendingReviewHash"],
    pendingReviewVersion: (record["pendingReviewVersion"] ?? null) as SyncState["pendingReviewVersion"],
    pendingReviewSince: (record["pendingReviewSince"] ?? null) as SyncState["pendingReviewSince"],
  });
}

interface SignedSyncStateFile {
  readonly format: typeof SYNC_STATE_HMAC_FORMAT;
  readonly state: unknown;
  readonly hmac: string;
}

function isSignedSyncStateFile(data: unknown): data is SignedSyncStateFile {
  if (data === null || typeof data !== "object") {
    return false;
  }
  const record = data as Record<string, unknown>;
  return (
    record["format"] === SYNC_STATE_HMAC_FORMAT &&
    typeof record["hmac"] === "string" &&
    "state" in record
  );
}

function normalizeSyncState(state: SyncState): SyncState {
  return {
    enabled: state.enabled,
    lastSyncedVersion: state.lastSyncedVersion,
    lastSyncedAt: state.lastSyncedAt,
    lastSyncedEtag: state.lastSyncedEtag,
    lastSyncedContentHash: state.lastSyncedContentHash,
    pendingPush: state.pendingPush,
    pendingPushSince: state.pendingPushSince,
    pendingReviewHash: state.pendingReviewHash ?? null,
    pendingReviewVersion: state.pendingReviewVersion ?? null,
    pendingReviewSince: state.pendingReviewSince ?? null,
  };
}

function serializeSyncStateForHmac(state: SyncState): string {
  const normalized = normalizeSyncState(state);
  return JSON.stringify({
    enabled: normalized.enabled,
    lastSyncedVersion: normalized.lastSyncedVersion,
    lastSyncedAt: normalized.lastSyncedAt,
    lastSyncedEtag: normalized.lastSyncedEtag,
    lastSyncedContentHash: normalized.lastSyncedContentHash,
    pendingPush: normalized.pendingPush,
    pendingPushSince: normalized.pendingPushSince,
    pendingReviewHash: normalized.pendingReviewHash,
    pendingReviewVersion: normalized.pendingReviewVersion,
    pendingReviewSince: normalized.pendingReviewSince,
  });
}

function computeSyncStateHmac(state: SyncState, key: Buffer): string {
  return createHmac("sha256", key)
    .update(serializeSyncStateForHmac(state), "utf-8")
    .digest("hex");
}

function safeCompareHmac(left: string, right: string): boolean {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

async function readSyncStateHmacKey(configDir: string): Promise<Buffer | null> {
  const keyPath = getSyncStateKeyPath(configDir);
  try {
    const key = await fs.readFile(keyPath);
    return key.length >= 16 ? key : null;
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === "ENOENT") {
      return null;
    }
    return null;
  }
}

async function getOrCreateSyncStateHmacKey(configDir: string): Promise<Buffer> {
  const existing = await readSyncStateHmacKey(configDir);
  if (existing !== null) {
    return existing;
  }

  const keyPath = getSyncStateKeyPath(configDir);
  const tmpName = `.sync-state-key-${randomBytes(6).toString("hex")}.tmp`;
  const tmpPath = path.join(configDir, tmpName);
  const key = randomBytes(32);

  await fs.writeFile(tmpPath, key, { mode: FILE_MODE });
  await fs.rename(tmpPath, keyPath);
  return key;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

function isOptionalNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function isOptionalNullableNumber(value: unknown): value is number | null | undefined {
  return value === undefined || value === null || typeof value === "number";
}

/**
 * Type guard for Node.js system errors (which carry a `code` property).
 */
function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}

/**
 * Extracts a human-readable message from an unknown error.
 */
function describeError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
