/**
 * PID-Based Version Locking
 *
 * This module provides PID-based locking for running Claude Code versions.
 * Unlike mtime-based locking (which can hold locks for 30 days after a crash),
 * PID-based locking can immediately detect when a process is no longer running.
 *
 * Lock files contain JSON with the PID and metadata, and staleness is determined
 * by checking if the process is still alive.
 */

import { basename, join } from 'path'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js'
import { logForDebugging } from '../debug.js'
import { isEnvDefinedFalsy, isEnvTruthy } from '../envUtils.js'
import { isENOENT, toError } from '../errors.js'
import { getFsImplementation } from '../fsOperations.js'
import { getProcessCommand } from '../genericProcessUtils.js'
import { logError } from '../log.js'
import {
  jsonParse,
  jsonStringify,
  writeFileSync_DEPRECATED,
} from '../slowOperations.js'

/**
 * Check if PID-based version locking is enabled.
 * When disabled, falls back to mtime-based locking (30-day timeout).
 *
 * Controlled by GrowthBook gate with local override:
 * - Set ENABLE_PID_BASED_VERSION_LOCKING=true to force-enable
 * - Set ENABLE_PID_BASED_VERSION_LOCKING=false to force-disable
 * - If unset, GrowthBook gate (tengu_pid_based_version_locking) controls rollout
 */
export function isPidBasedLockingEnabled(): boolean {
  const envVar = process.env.ENABLE_PID_BASED_VERSION_LOCKING
  // If env var is explicitly set, respect it
  if (isEnvTruthy(envVar)) {
    return true
  }
  if (isEnvDefinedFalsy(envVar)) {
    return false
  }
  // GrowthBook controls gradual rollout (returns false for external users)
  return getFeatureValue_CACHED_MAY_BE_STALE(
    'tengu_pid_based_version_locking',
    false,
  )
}

/**
 * Content stored in a version lock file
 */
export type VersionLockContent = {
  pid: number
  version: string
  execPath: string
  acquiredAt: number // timestamp when lock was acquired
}

/**
 * Information about a lock for diagnostic purposes
 */
export type LockInfo = {
  version: string
  pid: number
  isProcessRunning: boolean
  execPath: string
  acquiredAt: Date
  lockFilePath: string
}

// Fallback stale timeout (2 hours) - used when PID check is inconclusive
// This is much shorter than the previous 30-day timeout but still allows
// for edge cases like network filesystems where PID check might fail
const FALLBACK_STALE_MS = 2 * 60 * 60 * 1000

/**
 * Check if a process with the given PID is currently running
 * Uses signal 0 which doesn't actually send a signal but checks if we can
 */
export function isProcessRunning(pid: number): boolean {
  // PID 0 is special - it refers to the current process group, not a real process
  // PID 1 is init/systemd and is always running but shouldn't be considered for locks
  if (pid <= 1) {
    return false
  }

  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * Validate that a running process is actually a Claude process
 * This helps mitigate PID reuse issues
 */
function isClaudeProcess(pid: number, expectedExecPath: string): boolean {
  if (!isProcessRunning(pid)) {
    return false
  }

  // If the PID matches our current process, we know it's valid
  // This handles test environments where the command might not contain 'claude'
  if (pid === process.pid) {
    return true
  }

  try {
    const command = getProcessCommand(pid)
    if (!command) {
      // If we can't get the command, trust the PID check
      // This is conservative - we'd rather not delete a running version
      return true
    }

    // Check if the command contains 'claude' or the expected exec path
    const normalizedCommand = command.toLowerCase()
    const normalizedExecPath = expectedExecPath.toLowerCase()

    return (
      normalizedCommand.includes('claude') ||
      normalizedCommand.includes(normalizedExecPath)
    )
  } catch {
    // If command check fails, trust the PID check
    return true
  }
}

/**
 * Read and parse a lock file's content
 */
export function readLockContent(
  lockFilePath: string,
): VersionLockContent | null {
  const fs = getFsImplementation()

  try {
    const content = fs.readFileSync(lockFilePath, { encoding: 'utf8' })
    if (!content || content.trim() === '') {
      return null
    }

    const parsed = jsonParse(content) as VersionLockContent

    // Validate required fields
    if (typeof parsed.pid !== 'number' || !parsed.version || !parsed.execPath) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

/**
 * Check if a lock file represents an active lock (process still running)
 */
export function isLockActive(lockFilePath: string): boolean {
  const content = readLockContent(lockFilePath)

  if (!content) {
    return false
  }

  const { pid, execPath } = content

  // Primary check: is the process running?
  if (!isProcessRunning(pid)) {
    return false
  }

  // Secondary validation: is it actually a Claude process?
  // This helps with PID reuse scenarios
  if (!isClaudeProcess(pid, execPath)) {
    logForDebugging(
      `Lock PID ${pid} is running but does not appear to be Claude - treating as stale`,
    )
    return false
  }

  // Fallback: if the lock is very old (> 2 hours) and we can't validate
  // the command, be conservative and consider it potentially stale
  // This handles edge cases like network filesystems
  const fs = getFsImplementation()
  try {
    const stats = fs.statSync(lockFilePath)
    const age = Date.now() - stats.mtimeMs
    if (age > FALLBACK_STALE_MS) {
      // Double-check that we can still see the process
      if (!isProcessRunning(pid)) {
        return false
      }
    }
  } catch {
    // If we can't stat the file, trust the PID check
  }

  return true
}

/**
 * Write lock content to a file atomically
 */
function writeLockFile(
  lockFilePath: string,
  content: VersionLockContent,
): void {
  const fs = getFsImplementation()
  const tempPath = `${lockFilePath}.tmp.${process.pid}.${Date.now()}`

  try {
    writeFileSync_DEPRECATED(tempPath, jsonStringify(content, null, 2), {
      encoding: 'utf8',
      flush: true,
    })
    fs.renameSync(tempPath, lockFilePath)
  } catch (error) {
    // Clean up temp file on failure (best-effort)
    try {
      fs.unlinkSync(tempPath)
    } catch {
      // Ignore cleanup errors (ENOENT expected if write failed before file creation)
    }
    throw error
  }
}

/**
 * Try to acquire a lock on a version file
 * Returns a release function if successful, null if the lock is already held
 */
export async function tryAcquireLock(
  versionPath: string,
  lockFilePath: string,
): Promise<(() => void) | null> {
  const fs = getFsImplementation()
  const versionName = basename(versionPath)

  // Check if there's an existing active lock (including by our own process)
  // Use isLockActive for consistency with cleanup - it checks both PID running AND
  // validates it's actually a Claude process (to handle PID reuse scenarios)
  if (isLockActive(lockFilePath)) {
    const existingContent = readLockContent(lockFilePath)
    logForDebugging(
      `Cannot acquire lock for ${versionName} - held by PID ${existingContent?.pid}`,
    )
    return null
  }

  // Try to acquire the lock
  const lockContent: VersionLockContent = {
    pid: process.pid,
    version: versionName,
    execPath: process.execPath,
    acquiredAt: Date.now(),
  }

  try {
    writeLockFile(lockFilePath, lockContent)

    // Verify we actually got the lock (race condition check)
    const verifyContent = readLockContent(lockFilePath)
    if (verifyContent?.pid !== process.pid) {
      // Another process won the race
      return null
    }

    logForDebugging(`Acquired PID lock for ${versionName} (PID ${process.pid})`)

    // Return release function
    return () => {
      try {
        // Only release if we still own the lock
        const currentContent = readLockContent(lockFilePath)
        if (currentContent?.pid === process.pid) {
          fs.unlinkSync(lockFilePath)
          logForDebugging(`Released PID lock for ${versionName}`)
        }
      } catch (error) {
        logForDebugging(`Failed to release lock for ${versionName}: ${error}`)
      }
    }
  } catch (error) {
    logForDebugging(`Failed to acquire lock for ${versionName}: ${error}`)
    return null
  }
}

/**
 * Acquire a lock and hold it for the lifetime of the process
 * This is used for locking the currently running version
 */
export async function acquireProcessLifetimeLock(
  versionPath: string,
  lockFilePath: string,
): Promise<boolean> {
  const release = await tryAcquireLock(versionPath, lockFilePath)

  if (!release) {
    return false
  }

  // Register cleanup on process exit
  const cleanup = () => {
    try {
      release()
    } catch {
      // Ignore errors during process exit
    }
  }

  process.on('exit', cleanup)
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  // Don't call release() - we want to hold the lock until process exits
  return true
}

/**
 * Execute a callback while holding a lock
 * Returns true if the callback executed, false if lock couldn't be acquired
 */
export async function withLock(
  versionPath: string,
  lockFilePath: string,
  callback: () => void | Promise<void>,
): Promise<boolean> {
  const release = await tryAcquireLock(versionPath, lockFilePath)

  if (!release) {
    return false
  }

  try {
    await callback()
    return true
  } finally {
    release()
  }
}

/**
 * Get information about all version locks for diagnostics
 */
export function getAllLockInfo(locksDir: string): LockInfo[] {
  const fs = getFsImplementation()
  const lockInfos: LockInfo[] = []

  try {
    const lockFiles = fs
      .readdirStringSync(locksDir)
      .filter((f: string) => f.endsWith('.lock'))

    for (const lockFile of lockFiles) {
      const lockFilePath = join(locksDir, lockFile)
      const content = readLockContent(lockFilePath)

      if (content) {
        lockInfos.push({
          version: content.version,
          pid: content.pid,
          isProcessRunning: isProcessRunning(content.pid),
          execPath: content.execPath,
          acquiredAt: new Date(content.acquiredAt),
          lockFilePath,
        })
      }
    }
  } catch (error) {
    if (isENOENT(error)) {
      return lockInfos
    }
    logError(toError(error))
  }

  return lockInfos
}

/**
 * Clean up stale locks (locks where the process is no longer running)
 * Returns the number of locks cleaned up
 *
 * Handles both:
 * - PID-based locks (files containing JSON with PID)
 * - Legacy proper-lockfile locks (directories created by mtime-based locking)
 */
export function cleanupStaleLocks(locksDir: string): number {
  const fs = getFsImplementation()
  let cleanedCount = 0

  try {
    const lockEntries = fs
      .readdirStringSync(locksDir)
      .filter((f: string) => f.endsWith('.lock'))

    for (const lockEntry of lockEntries) {
      const lockFilePath = join(locksDir, lockEntry)

      try {
        const stats = fs.lstatSync(lockFilePath)

        if (stats.isDirectory()) {
          // Legacy proper-lockfile directory lock - always remove when PID-based
          // locking is enabled since these are from a different locking mechanism
          fs.rmSync(lockFilePath, { recursive: true, force: true })
          cleanedCount++
          logForDebugging(`Cleaned up legacy directory lock: ${lockEntry}`)
        } else if (!isLockActive(lockFilePath)) {
          // PID-based file lock with no running process
          fs.unlinkSync(lockFilePath)
          cleanedCount++
          logForDebugging(`Cleaned up stale lock: ${lockEntry}`)
        }
      } catch {
        // Ignore individual cleanup errors
      }
    }
  } catch (error) {
    if (isENOENT(error)) {
      return 0
    }
    logError(toError(error))
  }

  return cleanedCount
}
