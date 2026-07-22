/**
 * Shared infrastructure for profiler modules (startupProfiler, queryProfiler,
 * headlessProfiler). All three use the same perf_hooks timeline and the same
 * line format for detailed reports.
 */

import type { performance as PerformanceType } from 'perf_hooks'
import { formatFileSize } from './format.js'

// Lazy-load performance API only when profiling is enabled.
// Shared across all profilers — perf_hooks.performance is a process-wide singleton.
let performance: typeof PerformanceType | null = null

export function getPerformance(): typeof PerformanceType {
  if (!performance) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    performance = require('perf_hooks').performance
  }
  return performance!
}

export function formatMs(ms: number): string {
  return ms.toFixed(3)
}

/**
 * Render a single timeline line in the shared profiler report format:
 *   [+  total.ms] (+  delta.ms) name [extra] [| RSS: .., Heap: ..]
 *
 * totalPad/deltaPad control the padStart width so callers can align columns
 * based on their expected magnitude (startup uses 8/7, query uses 10/9).
 */
export function formatTimelineLine(
  totalMs: number,
  deltaMs: number,
  name: string,
  memory: NodeJS.MemoryUsage | undefined,
  totalPad: number,
  deltaPad: number,
  extra = '',
): string {
  const memInfo = memory
    ? ` | RSS: ${formatFileSize(memory.rss)}, Heap: ${formatFileSize(memory.heapUsed)}`
    : ''
  return `[+${formatMs(totalMs).padStart(totalPad)}ms] (+${formatMs(deltaMs).padStart(deltaPad)}ms) ${name}${extra}${memInfo}`
}
