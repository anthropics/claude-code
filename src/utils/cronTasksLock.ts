// Scheduler lease lock for .claude/scheduled_tasks.json.
//
// When multiple Claude sessions run in the same project directory, only one
// should drive the cron scheduler. The first session to acquire this lock
// becomes the scheduler; others stay passive and periodically probe the lock.
// If the owner dies (PID no longer running), a passive session takes over.
//
// Pattern mirrors computerUseLock.ts: O_EXCL atomic create, PID liveness
// probe, stale-lock recovery, cleanup-on-exit.

import { mkdir, readFile, unlink, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { z } from 'zod/v4'
import { getProjectRoot, getSessionId } from '../bootstrap/state.js'
import { registerCleanup } from './cleanupRegistry.js'
import { logForDebugging } from './debug.js'
import { getErrnoCode } from './errors.js'
import { isProcessRunning } from './genericProcessUtils.js'
import { safeParseJSON } from './json.js'
import { lazySchema } from './lazySchema.js'
import { jsonStringify } from './slowOperations.js'

const LOCK_FILE_REL = join('.claude', 'scheduled_tasks.lock')

const schedulerLockSchema = lazySchema(() =>
  z.object({
    sessionId: z.string(),
    pid: z.number(),
    acquiredAt: z.number(),
  }),
)
type SchedulerLock = z.infer<ReturnType<typeof schedulerLockSchema>>

/**
 * Options for out-of-REPL callers (Agent SDK daemon) that don't have
 * bootstrap state. When omitted, falls back to getProjectRoot() +
 * getSessionId() as before. lockIdentity should be stable for the lifetime
 * of one daemon process (e.g. a randomUUID() captured at startup).
 */
export type SchedulerLockOptions = {
  dir?: string
  lockIdentity?: string
}

let unregisterCleanup: (() => void) | undefined
// Suppress repeat "held by X" log lines when polling a live owner.
let lastBlockedBy: string | undefined

function getLockPath(dir?: string): string {
  return join(dir ?? getProjectRoot(), LOCK_FILE_REL)
}

async function readLock(dir?: string): Promise<SchedulerLock | undefined> {
  let raw: string
  try {
    raw = await readFile(getLockPath(dir), 'utf8')
  } catch {
    return undefined
  }
  const result = schedulerLockSchema().safeParse(safeParseJSON(raw, false))
  return result.success ? result.data : undefined
}

async function tryCreateExclusive(
  lock: SchedulerLock,
  dir?: string,
): Promise<boolean> {
  const path = getLockPath(dir)
  const body = jsonStringify(lock)
  try {
    await writeFile(path, body, { flag: 'wx' })
    return true
  } catch (e: unknown) {
    const code = getErrnoCode(e)
    if (code === 'EEXIST') return false
    if (code === 'ENOENT') {
      // .claude/ doesn't exist yet — create it and retry once. In steady
      // state the dir already exists (scheduled_tasks.json lives there),
      // so this path is hit at most once.
      await mkdir(dirname(path), { recursive: true })
      try {
        await writeFile(path, body, { flag: 'wx' })
        return true
      } catch (retryErr: unknown) {
        if (getErrnoCode(retryErr) === 'EEXIST') return false
        throw retryErr
      }
    }
    throw e
  }
}

function registerLockCleanup(opts?: SchedulerLockOptions): void {
  unregisterCleanup?.()
  unregisterCleanup = registerCleanup(async () => {
    await releaseSchedulerLock(opts)
  })
}

/**
 * Try to acquire the scheduler lock for the current session.
 * Returns true on success, false if another live session holds it.
 *
 * Uses O_EXCL ('wx') for atomic test-and-set. If the file exists:
 *   - Already ours → true (idempotent re-acquire)
 *   - Another live PID → false
 *   - Stale (PID dead / corrupt) → unlink and retry exclusive create once
 *
 * If two sessions race to recover a stale lock, only one create succeeds.
 */
export async function tryAcquireSchedulerLock(
  opts?: SchedulerLockOptions,
): Promise<boolean> {
  const dir = opts?.dir
  // "sessionId" in the lock file is really just a stable owner key. REPL
  // uses getSessionId(); daemon callers supply their own UUID. PID remains
  // the liveness signal regardless.
  const sessionId = opts?.lockIdentity ?? getSessionId()
  const lock: SchedulerLock = {
    sessionId,
    pid: process.pid,
    acquiredAt: Date.now(),
  }

  if (await tryCreateExclusive(lock, dir)) {
    lastBlockedBy = undefined
    registerLockCleanup(opts)
    logForDebugging(
      `[ScheduledTasks] acquired scheduler lock (PID ${process.pid})`,
    )
    return true
  }

  const existing = await readLock(dir)

  // Already ours (idempotent). After --resume the session ID is restored
  // but the process has a new PID — update the lock file so other sessions
  // see a live PID and don't steal it.
  if (existing?.sessionId === sessionId) {
    if (existing.pid !== process.pid) {
      await writeFile(getLockPath(dir), jsonStringify(lock))
      registerLockCleanup(opts)
    }
    return true
  }

  // Corrupt or unparseable — treat as stale.
  // Another live session — blocked.
  if (existing && isProcessRunning(existing.pid)) {
    if (lastBlockedBy !== existing.sessionId) {
      lastBlockedBy = existing.sessionId
      logForDebugging(
        `[ScheduledTasks] scheduler lock held by session ${existing.sessionId} (PID ${existing.pid})`,
      )
    }
    return false
  }

  // Stale — unlink and retry the exclusive create once.
  if (existing) {
    logForDebugging(
      `[ScheduledTasks] recovering stale scheduler lock from PID ${existing.pid}`,
    )
  }
  await unlink(getLockPath(dir)).catch(() => {})
  if (await tryCreateExclusive(lock, dir)) {
    lastBlockedBy = undefined
    registerLockCleanup(opts)
    return true
  }
  // Another session won the recovery race.
  return false
}

/**
 * Release the scheduler lock if the current session owns it.
 */
export async function releaseSchedulerLock(
  opts?: SchedulerLockOptions,
): Promise<void> {
  unregisterCleanup?.()
  unregisterCleanup = undefined
  lastBlockedBy = undefined

  const dir = opts?.dir
  const sessionId = opts?.lockIdentity ?? getSessionId()
  const existing = await readLock(dir)
  if (!existing || existing.sessionId !== sessionId) return
  try {
    await unlink(getLockPath(dir))
    logForDebugging('[ScheduledTasks] released scheduler lock')
  } catch {
    // Already gone.
  }
}
