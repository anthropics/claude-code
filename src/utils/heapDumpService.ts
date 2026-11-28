/**
 * Service for heap dump capture.
 * Used by the /heapdump command.
 */

import { createWriteStream, writeFileSync } from 'fs'
import { readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import {
  getHeapSnapshot,
  getHeapSpaceStatistics,
  getHeapStatistics,
  type HeapSpaceInfo,
} from 'v8'
import { getSessionId } from '../bootstrap/state.js'
import { logEvent } from '../services/analytics/index.js'
import { logForDebugging } from './debug.js'
import { toError } from './errors.js'
import { getDesktopPath } from './file.js'
import { getFsImplementation } from './fsOperations.js'
import { logError } from './log.js'
import { jsonStringify } from './slowOperations.js'

export type HeapDumpResult = {
  success: boolean
  heapPath?: string
  diagPath?: string
  error?: string
}

/**
 * Memory diagnostics captured alongside heap dump.
 * Helps identify if leak is in V8 heap (captured in snapshot) or native memory (not captured).
 */
export type MemoryDiagnostics = {
  timestamp: string
  sessionId: string
  trigger: 'manual' | 'auto-1.5GB'
  dumpNumber: number // 1st, 2nd, etc. auto dump in this session (0 for manual)
  uptimeSeconds: number
  memoryUsage: {
    heapUsed: number
    heapTotal: number
    external: number
    arrayBuffers: number
    rss: number
  }
  memoryGrowthRate: {
    bytesPerSecond: number
    mbPerHour: number
  }
  v8HeapStats: {
    heapSizeLimit: number // Max heap size allowed
    mallocedMemory: number // Memory allocated outside V8 heap
    peakMallocedMemory: number // Peak native memory
    detachedContexts: number // Leaked contexts - key leak indicator!
    nativeContexts: number // Active contexts
  }
  v8HeapSpaces?: Array<{
    name: string
    size: number
    used: number
    available: number
  }>
  resourceUsage: {
    maxRSS: number // Peak RSS in bytes
    userCPUTime: number
    systemCPUTime: number
  }
  activeHandles: number // Leaked timers, sockets, file handles
  activeRequests: number // Pending async operations
  openFileDescriptors?: number // Linux/macOS - indicates resource leaks
  analysis: {
    potentialLeaks: string[]
    recommendation: string
  }
  smapsRollup?: string // Linux only - detailed memory breakdown
  platform: string
  nodeVersion: string
  ccVersion: string
}

/**
 * Capture memory diagnostics.
 * This helps identify if the leak is in V8 heap (captured) or native memory (not captured).
 */
export async function captureMemoryDiagnostics(
  trigger: 'manual' | 'auto-1.5GB',
  dumpNumber = 0,
): Promise<MemoryDiagnostics> {
  const usage = process.memoryUsage()
  const heapStats = getHeapStatistics()
  const resourceUsage = process.resourceUsage()
  const uptimeSeconds = process.uptime()

  // getHeapSpaceStatistics() is not available in Bun
  let heapSpaceStats: HeapSpaceInfo[] | undefined
  try {
    heapSpaceStats = getHeapSpaceStatistics()
  } catch {
    // Not available in Bun runtime
  }

  // Get active handles/requests count (these are internal APIs but stable)
  const activeHandles = (
    process as unknown as { _getActiveHandles: () => unknown[] }
  )._getActiveHandles().length
  const activeRequests = (
    process as unknown as { _getActiveRequests: () => unknown[] }
  )._getActiveRequests().length

  // Try to count open file descriptors (Linux/macOS)
  let openFileDescriptors: number | undefined
  try {
    openFileDescriptors = (await readdir('/proc/self/fd')).length
  } catch {
    // Not on Linux - try macOS approach would require lsof, skip for now
  }

  // Try to read Linux smaps_rollup for detailed memory breakdown
  let smapsRollup: string | undefined
  try {
    smapsRollup = await readFile('/proc/self/smaps_rollup', 'utf8')
  } catch {
    // Not on Linux or no access - this is fine
  }

  // Calculate native memory (RSS - heap) and growth rate
  const nativeMemory = usage.rss - usage.heapUsed
  const bytesPerSecond = uptimeSeconds > 0 ? usage.rss / uptimeSeconds : 0
  const mbPerHour = (bytesPerSecond * 3600) / (1024 * 1024)

  // Identify potential leaks
  const potentialLeaks: string[] = []
  if (heapStats.number_of_detached_contexts > 0) {
    potentialLeaks.push(
      `${heapStats.number_of_detached_contexts} detached context(s) - possible iframe/context leak`,
    )
  }
  if (activeHandles > 100) {
    potentialLeaks.push(
      `${activeHandles} active handles - possible timer/socket leak`,
    )
  }
  if (nativeMemory > usage.heapUsed) {
    potentialLeaks.push(
      'Native memory > heap - leak may be in native addons (node-pty, sharp, etc.)',
    )
  }
  if (mbPerHour > 100) {
    potentialLeaks.push(
      `High memory growth rate: ${mbPerHour.toFixed(1)} MB/hour`,
    )
  }
  if (openFileDescriptors && openFileDescriptors > 500) {
    potentialLeaks.push(
      `${openFileDescriptors} open file descriptors - possible file/socket leak`,
    )
  }

  return {
    timestamp: new Date().toISOString(),
    sessionId: getSessionId(),
    trigger,
    dumpNumber,
    uptimeSeconds,
    memoryUsage: {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers,
      rss: usage.rss,
    },
    memoryGrowthRate: {
      bytesPerSecond,
      mbPerHour,
    },
    v8HeapStats: {
      heapSizeLimit: heapStats.heap_size_limit,
      mallocedMemory: heapStats.malloced_memory,
      peakMallocedMemory: heapStats.peak_malloced_memory,
      detachedContexts: heapStats.number_of_detached_contexts,
      nativeContexts: heapStats.number_of_native_contexts,
    },
    v8HeapSpaces: heapSpaceStats?.map(space => ({
      name: space.space_name,
      size: space.space_size,
      used: space.space_used_size,
      available: space.space_available_size,
    })),
    resourceUsage: {
      maxRSS: resourceUsage.maxRSS * 1024, // Convert KB to bytes
      userCPUTime: resourceUsage.userCPUTime,
      systemCPUTime: resourceUsage.systemCPUTime,
    },
    activeHandles,
    activeRequests,
    openFileDescriptors,
    analysis: {
      potentialLeaks,
      recommendation:
        potentialLeaks.length > 0
          ? `WARNING: ${potentialLeaks.length} potential leak indicator(s) found. See potentialLeaks array.`
          : 'No obvious leak indicators. Check heap snapshot for retained objects.',
    },
    smapsRollup,
    platform: process.platform,
    nodeVersion: process.version,
    ccVersion: MACRO.VERSION,
  }
}

/**
 * Core heap dump function — captures heap snapshot + diagnostics to ~/Desktop.
 *
 * Diagnostics are written BEFORE the heap snapshot is captured, because the
 * V8 heap snapshot serialization can crash for very large heaps. By writing
 * diagnostics first, we still get useful memory info even if the snapshot fails.
 */
export async function performHeapDump(
  trigger: 'manual' | 'auto-1.5GB' = 'manual',
  dumpNumber = 0,
): Promise<HeapDumpResult> {
  try {
    const sessionId = getSessionId()

    // Capture diagnostics before any other async I/O —
    // the heap dump itself allocates memory and would skew the numbers.
    const diagnostics = await captureMemoryDiagnostics(trigger, dumpNumber)

    const toGB = (bytes: number): string =>
      (bytes / 1024 / 1024 / 1024).toFixed(3)
    logForDebugging(`[HeapDump] Memory state:
  heapUsed: ${toGB(diagnostics.memoryUsage.heapUsed)} GB (in snapshot)
  external: ${toGB(diagnostics.memoryUsage.external)} GB (NOT in snapshot)
  rss: ${toGB(diagnostics.memoryUsage.rss)} GB (total process)
  ${diagnostics.analysis.recommendation}`)

    const dumpDir = getDesktopPath()
    await getFsImplementation().mkdir(dumpDir)

    const suffix = dumpNumber > 0 ? `-dump${dumpNumber}` : ''
    const heapFilename = `${sessionId}${suffix}.heapsnapshot`
    const diagFilename = `${sessionId}${suffix}-diagnostics.json`
    const heapPath = join(dumpDir, heapFilename)
    const diagPath = join(dumpDir, diagFilename)

    // Write diagnostics first (cheap, unlikely to fail)
    await writeFile(diagPath, jsonStringify(diagnostics, null, 2), {
      mode: 0o600,
    })
    logForDebugging(`[HeapDump] Diagnostics written to ${diagPath}`)

    // Write heap snapshot (this can crash for very large heaps)
    await writeHeapSnapshot(heapPath)
    logForDebugging(`[HeapDump] Heap dump written to ${heapPath}`)

    logEvent('tengu_heap_dump', {
      triggerManual: trigger === 'manual',
      triggerAuto15GB: trigger === 'auto-1.5GB',
      dumpNumber,
      success: true,
    })

    return { success: true, heapPath, diagPath }
  } catch (err) {
    const error = toError(err)
    logError(error)
    logEvent('tengu_heap_dump', {
      triggerManual: trigger === 'manual',
      triggerAuto15GB: trigger === 'auto-1.5GB',
      dumpNumber,
      success: false,
    })
    return { success: false, error: error.message }
  }
}

/**
 * Write heap snapshot to a file.
 * Uses pipeline() which handles stream cleanup automatically on errors.
 */
async function writeHeapSnapshot(filepath: string): Promise<void> {
  if (typeof Bun !== 'undefined') {
    // In Bun, heapsnapshots are currently not streaming.
    // Use synchronous I/O despite potentially large filesize so that we avoid cloning the string for cross-thread usage.
    //
    /* eslint-disable custom-rules/no-sync-fs -- intentionally sync to avoid cloning large heap snapshot string for cross-thread usage */
    // @ts-expect-error 2nd argument is in the next version of Bun
    writeFileSync(filepath, Bun.generateHeapSnapshot('v8', 'arraybuffer'), {
      mode: 0o600,
    })
    /* eslint-enable custom-rules/no-sync-fs */

    // Force GC to try to free that heap snapshot sooner.
    Bun.gc(true)
    return
  }
  const writeStream = createWriteStream(filepath, { mode: 0o600 })
  const heapSnapshotStream = getHeapSnapshot()
  await pipeline(heapSnapshotStream, writeStream)
}
