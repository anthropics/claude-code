import { mkdir, readFile, unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import { getSessionId } from '../../bootstrap/state.js'
import { registerCleanup } from '../../utils/cleanupRegistry.js'
import { logForDebugging } from '../../utils/debug.js'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'
import { jsonParse, jsonStringify } from '../../utils/slowOperations.js'
import { getErrnoCode } from '../errors.js'

const LOCK_FILENAME = 'computer-use.lock'

// Holds the unregister function for the shutdown cleanup handler.
// Set when the lock is acquired, cleared when released.
let unregisterCleanup: (() => void) | undefined

type ComputerUseLock = {
  readonly sessionId: string
  readonly pid: number
  readonly acquiredAt: number
}

export type AcquireResult =
  | { readonly kind: 'acquired'; readonly fresh: boolean }
  | { readonly kind: 'blocked'; readonly by: string }

export type CheckResult =
  | { readonly kind: 'free' }
  | { readonly kind: 'held_by_self' }
  | { readonly kind: 'blocked'; readonly by: string }

const FRESH: AcquireResult = { kind: 'acquired', fresh: true }
const REENTRANT: AcquireResult = { kind: 'acquired', fresh: false }

function isComputerUseLock(value: unknown): value is ComputerUseLock {
  if (typeof value !== 'object' || value === null) return false
  return (
    'sessionId' in value &&
    typeof value.sessionId === 'string' &&
    'pid' in value &&
    typeof value.pid === 'number'
  )
}

function getLockPath(): string {
  return join(getClaudeConfigHomeDir(), LOCK_FILENAME)
}

async function readLock(): Promise<ComputerUseLock | undefined> {
  try {
    const raw = await readFile(getLockPath(), 'utf8')
    const parsed: unknown = jsonParse(raw)
    return isComputerUseLock(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

/**
 * Check whether a process is still running (signal 0 probe).
 *
 * Note: there is a small window for PID reuse — if the owning process
 * exits and an unrelated process is assigned the same PID, the check
 * will return true. This is extremely unlikely in practice.
 */
function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * Attempt to create the lock file atomically with O_EXCL.
 * Returns true on success, false if the file already exists.
 * Throws for other errors.
 */
async function tryCreateExclusive(lock: ComputerUseLock): Promise<boolean> {
  try {
    await writeFile(getLockPath(), jsonStringify(lock), { flag: 'wx' })
    return true
  } catch (e: unknown) {
    if (getErrnoCode(e) === 'EEXIST') return false
    throw e
  }
}

/**
 * Register a shutdown cleanup handler so the lock is released even if
 * turn-end cleanup is never reached (e.g. the user runs /exit while
 * a tool call is in progress).
 */
function registerLockCleanup(): void {
  unregisterCleanup?.()
  unregisterCleanup = registerCleanup(async () => {
    await releaseComputerUseLock()
  })
}

/**
 * Check lock state without acquiring. Used for `request_access` /
 * `list_granted_applications` — the package's `defersLockAcquire` contract:
 * these tools check but don't take the lock, so the enter-notification and
 * overlay don't fire while the model is only asking for permission.
 *
 * Does stale-PID recovery (unlinks) so a dead session's lock doesn't block
 * `request_access`. Does NOT create — that's `tryAcquireComputerUseLock`'s job.
 */
export async function checkComputerUseLock(): Promise<CheckResult> {
  const existing = await readLock()
  if (!existing) return { kind: 'free' }
  if (existing.sessionId === getSessionId()) return { kind: 'held_by_self' }
  if (isProcessRunning(existing.pid)) {
    return { kind: 'blocked', by: existing.sessionId }
  }
  logForDebugging(
    `Recovering stale computer-use lock from session ${existing.sessionId} (PID ${existing.pid})`,
  )
  await unlink(getLockPath()).catch(() => {})
  return { kind: 'free' }
}

/**
 * Zero-syscall check: does THIS process believe it holds the lock?
 * True iff `tryAcquireComputerUseLock` succeeded and `releaseComputerUseLock`
 * hasn't run yet. Used to gate the per-turn release in `cleanup.ts` so
 * non-CU turns don't touch disk.
 */
export function isLockHeldLocally(): boolean {
  return unregisterCleanup !== undefined
}

/**
 * Try to acquire the computer-use lock for the current session.
 *
 * `{kind: 'acquired', fresh: true}` — first tool call of a CU turn. Callers fire
 * enter notifications on this. `{kind: 'acquired', fresh: false}` — re-entrant,
 * same session already holds it. `{kind: 'blocked', by}` — another live session
 * holds it.
 *
 * Uses O_EXCL (open 'wx') for atomic test-and-set — the OS guarantees at
 * most one process sees the create succeed. If the file already exists,
 * we check ownership and PID liveness; for a stale lock we unlink and
 * retry the exclusive create once. If two sessions race to recover the
 * same stale lock, only one create succeeds (the other reads the winner).
 */
export async function tryAcquireComputerUseLock(): Promise<AcquireResult> {
  const sessionId = getSessionId()
  const lock: ComputerUseLock = {
    sessionId,
    pid: process.pid,
    acquiredAt: Date.now(),
  }

  await mkdir(getClaudeConfigHomeDir(), { recursive: true })

  // Fresh acquisition.
  if (await tryCreateExclusive(lock)) {
    registerLockCleanup()
    return FRESH
  }

  const existing = await readLock()

  // Corrupt/unparseable — treat as stale (can't extract a blocking ID).
  if (!existing) {
    await unlink(getLockPath()).catch(() => {})
    if (await tryCreateExclusive(lock)) {
      registerLockCleanup()
      return FRESH
    }
    return { kind: 'blocked', by: (await readLock())?.sessionId ?? 'unknown' }
  }

  // Already held by this session.
  if (existing.sessionId === sessionId) return REENTRANT

  // Another live session holds it — blocked.
  if (isProcessRunning(existing.pid)) {
    return { kind: 'blocked', by: existing.sessionId }
  }

  // Stale lock — recover. Unlink then retry the exclusive create.
  // If another session is also recovering, one EEXISTs and reads the winner.
  logForDebugging(
    `Recovering stale computer-use lock from session ${existing.sessionId} (PID ${existing.pid})`,
  )
  await unlink(getLockPath()).catch(() => {})
  if (await tryCreateExclusive(lock)) {
    registerLockCleanup()
    return FRESH
  }
  return { kind: 'blocked', by: (await readLock())?.sessionId ?? 'unknown' }
}

/**
 * Release the computer-use lock if the current session owns it. Returns
 * `true` if we actually unlinked the file (i.e., we held it) — callers fire
 * exit notifications on this. Idempotent: subsequent calls return `false`.
 */
export async function releaseComputerUseLock(): Promise<boolean> {
  unregisterCleanup?.()
  unregisterCleanup = undefined

  const existing = await readLock()
  if (!existing || existing.sessionId !== getSessionId()) return false
  try {
    await unlink(getLockPath())
    logForDebugging('Released computer-use lock')
    return true
  } catch {
    return false
  }
}
