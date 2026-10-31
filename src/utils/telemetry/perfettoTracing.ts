/**
 * Perfetto Tracing for Claude Code (Ant-only)
 *
 * This module generates traces in the Chrome Trace Event format that can be
 * viewed in ui.perfetto.dev or Chrome's chrome://tracing.
 *
 * NOTE: This feature is ant-only and eliminated from external builds.
 *
 * The trace file includes:
 * - Agent hierarchy (parent-child relationships in a swarm)
 * - API requests with TTFT, TTLT, prompt length, cache stats, msg ID, speculative flag
 * - Tool executions with name, duration, and token usage
 * - User input waiting time
 *
 * Usage:
 * 1. Enable via CLAUDE_CODE_PERFETTO_TRACE=1 or CLAUDE_CODE_PERFETTO_TRACE=<path>
 * 2. Optionally set CLAUDE_CODE_PERFETTO_WRITE_INTERVAL_S=<positive integer> to write the
 *    trace file periodically (default: write only on exit).
 * 3. Run Claude Code normally
 * 4. Trace file is written to ~/.claude/traces/trace-<session-id>.json
 *    or to the specified path
 * 5. Open in ui.perfetto.dev to visualize
 */

import { feature } from 'bun:bundle'
import { mkdirSync, writeFileSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { getSessionId } from '../../bootstrap/state.js'
import { registerCleanup } from '../cleanupRegistry.js'
import { logForDebugging } from '../debug.js'
import {
  getClaudeConfigHomeDir,
  isEnvDefinedFalsy,
  isEnvTruthy,
} from '../envUtils.js'
import { errorMessage } from '../errors.js'
import { djb2Hash } from '../hash.js'
import { jsonStringify } from '../slowOperations.js'
import { getAgentId, getAgentName, getParentSessionId } from '../teammate.js'

/**
 * Chrome Trace Event format types
 * See: https://docs.google.com/document/d/1CvAClvFfyA5R-PhYUmn5OOQtYMH4h6I0nSsKchNAySU
 */

export type TraceEventPhase =
  | 'B' // Begin duration event
  | 'E' // End duration event
  | 'X' // Complete event (with duration)
  | 'i' // Instant event
  | 'C' // Counter event
  | 'b' // Async begin
  | 'n' // Async instant
  | 'e' // Async end
  | 'M' // Metadata event

export type TraceEvent = {
  name: string
  cat: string
  ph: TraceEventPhase
  ts: number // Timestamp in microseconds
  pid: number // Process ID (we use 1 for main, agent IDs for subagents)
  tid: number // Thread ID (we use numeric hash of agent name or 1 for main)
  dur?: number // Duration in microseconds (for 'X' events)
  args?: Record<string, unknown>
  id?: string // For async events
  scope?: string
}

/**
 * Agent info for tracking hierarchy
 */
type AgentInfo = {
  agentId: string
  agentName: string
  parentAgentId?: string
  processId: number
  threadId: number
}

/**
 * Pending span for tracking begin/end pairs
 */
type PendingSpan = {
  name: string
  category: string
  startTime: number
  agentInfo: AgentInfo
  args: Record<string, unknown>
}

// Global state for the Perfetto tracer
let isEnabled = false
let tracePath: string | null = null
// Metadata events (ph: 'M' — process/thread names, parent links) are kept
// separate so they survive eviction — Perfetto UI needs them to label
// tracks. Bounded by agent count (~3 events per agent).
const metadataEvents: TraceEvent[] = []
const events: TraceEvent[] = []
// events[] cap. Cron-driven sessions run for days; 22 push sites × many
// turns would otherwise grow unboundedly (periodicWrite flushes to disk but
// does not truncate — it writes the full snapshot). At ~300B/event this is
// ~30MB, enough trace history for any debugging session. Eviction drops the
// oldest half when hit, amortized O(1).
const MAX_EVENTS = 100_000
const pendingSpans = new Map<string, PendingSpan>()
const agentRegistry = new Map<string, AgentInfo>()
let totalAgentCount = 0
let startTimeMs = 0
let spanIdCounter = 0
let traceWritten = false // Flag to avoid double writes

// Map agent IDs to numeric process IDs (Perfetto requires numeric IDs)
let processIdCounter = 1
const agentIdToProcessId = new Map<string, number>()

// Periodic write interval handle
let writeIntervalId: ReturnType<typeof setInterval> | null = null

const STALE_SPAN_TTL_MS = 30 * 60 * 1000 // 30 minutes
const STALE_SPAN_CLEANUP_INTERVAL_MS = 60 * 1000 // 1 minute
let staleSpanCleanupId: ReturnType<typeof setInterval> | null = null

/**
 * Convert a string to a numeric hash for use as thread ID
 */
function stringToNumericHash(str: string): number {
  return Math.abs(djb2Hash(str)) || 1 // Ensure non-zero
}

/**
 * Get or create a numeric process ID for an agent
 */
function getProcessIdForAgent(agentId: string): number {
  const existing = agentIdToProcessId.get(agentId)
  if (existing !== undefined) return existing

  processIdCounter++
  agentIdToProcessId.set(agentId, processIdCounter)
  return processIdCounter
}

/**
 * Get current agent info
 */
function getCurrentAgentInfo(): AgentInfo {
  const agentId = getAgentId() ?? getSessionId()
  const agentName = getAgentName() ?? 'main'
  const parentSessionId = getParentSessionId()

  // Check if we've already registered this agent
  const existing = agentRegistry.get(agentId)
  if (existing) return existing

  const info: AgentInfo = {
    agentId,
    agentName,
    parentAgentId: parentSessionId,
    processId: agentId === getSessionId() ? 1 : getProcessIdForAgent(agentId),
    threadId: stringToNumericHash(agentName),
  }

  agentRegistry.set(agentId, info)
  totalAgentCount++
  return info
}

/**
 * Get timestamp in microseconds relative to trace start
 */
function getTimestamp(): number {
  return (Date.now() - startTimeMs) * 1000
}

/**
 * Generate a unique span ID
 */
function generateSpanId(): string {
  return `span_${++spanIdCounter}`
}

/**
 * Evict pending spans older than STALE_SPAN_TTL_MS.
 * Mirrors the TTL cleanup pattern in sessionTracing.ts.
 */
function evictStaleSpans(): void {
  const now = getTimestamp()
  const ttlUs = STALE_SPAN_TTL_MS * 1000 // Convert ms to microseconds
  for (const [spanId, span] of pendingSpans) {
    if (now - span.startTime > ttlUs) {
      // Emit an end event so the span shows up in the trace as incomplete
      events.push({
        name: span.name,
        cat: span.category,
        ph: 'E',
        ts: now,
        pid: span.agentInfo.processId,
        tid: span.agentInfo.threadId,
        args: {
          ...span.args,
          evicted: true,
          duration_ms: (now - span.startTime) / 1000,
        },
      })
      pendingSpans.delete(spanId)
    }
  }
}

/**
 * Build the full trace document (Chrome Trace JSON format).
 */
function buildTraceDocument(): string {
  return jsonStringify({
    traceEvents: [...metadataEvents, ...events],
    metadata: {
      session_id: getSessionId(),
      trace_start_time: new Date(startTimeMs).toISOString(),
      agent_count: totalAgentCount,
      total_event_count: metadataEvents.length + events.length,
    },
  })
}

/**
 * Drop the oldest half of events[] when over MAX_EVENTS. Called from the
 * stale-span cleanup interval (60s). The half-batch splice keeps this
 * amortized O(1) — we don't pay splice cost per-push. A synthetic marker
 * is inserted so the gap is visible in ui.perfetto.dev.
 */
function evictOldestEvents(): void {
  if (events.length < MAX_EVENTS) return
  const dropped = events.splice(0, MAX_EVENTS / 2)
  events.unshift({
    name: 'trace_truncated',
    cat: '__metadata',
    ph: 'i',
    ts: dropped[dropped.length - 1]?.ts ?? 0,
    pid: 1,
    tid: 0,
    args: { dropped_events: dropped.length },
  })
  logForDebugging(
    `[Perfetto] Evicted ${dropped.length} oldest events (cap ${MAX_EVENTS})`,
  )
}

/**
 * Initialize Perfetto tracing
 * Call this early in the application lifecycle
 */
export function initializePerfettoTracing(): void {
  const envValue = process.env.CLAUDE_CODE_PERFETTO_TRACE
  logForDebugging(
    `[Perfetto] initializePerfettoTracing called, env value: ${envValue}`,
  )

  // Wrap in feature() for dead code elimination - entire block removed from external builds
  if (feature('PERFETTO_TRACING')) {
    if (!envValue || isEnvDefinedFalsy(envValue)) {
      logForDebugging(
        '[Perfetto] Tracing disabled (env var not set or disabled)',
      )
      return
    }

    isEnabled = true
    startTimeMs = Date.now()

    // Determine trace file path
    if (isEnvTruthy(envValue)) {
      const tracesDir = join(getClaudeConfigHomeDir(), 'traces')
      tracePath = join(tracesDir, `trace-${getSessionId()}.json`)
    } else {
      // Use the provided path
      tracePath = envValue
    }

    logForDebugging(
      `[Perfetto] Tracing enabled, will write to: ${tracePath}, isEnabled=${isEnabled}`,
    )

    // Start periodic full-trace write if CLAUDE_CODE_PERFETTO_WRITE_INTERVAL_S is a positive integer
    const intervalSec = parseInt(
      process.env.CLAUDE_CODE_PERFETTO_WRITE_INTERVAL_S ?? '',
      10,
    )
    if (intervalSec > 0) {
      writeIntervalId = setInterval(() => {
        void periodicWrite()
      }, intervalSec * 1000)
      // Don't let the interval keep the process alive on its own
      if (writeIntervalId.unref) writeIntervalId.unref()
      logForDebugging(
        `[Perfetto] Periodic write enabled, interval: ${intervalSec}s`,
      )
    }

    // Start stale span cleanup interval
    staleSpanCleanupId = setInterval(() => {
      evictStaleSpans()
      evictOldestEvents()
    }, STALE_SPAN_CLEANUP_INTERVAL_MS)
    if (staleSpanCleanupId.unref) staleSpanCleanupId.unref()

    // Register cleanup to write final trace on exit
    registerCleanup(async () => {
      logForDebugging('[Perfetto] Cleanup callback invoked')
      await writePerfettoTrace()
    })

    // Also register a beforeExit handler as a fallback
    // This ensures the trace is written even if cleanup registry is not called
    process.on('beforeExit', () => {
      logForDebugging('[Perfetto] beforeExit handler invoked')
      void writePerfettoTrace()
    })

    // Register a synchronous exit handler as a last resort
    // This is the final fallback to ensure trace is written before process exits
    process.on('exit', () => {
      if (!traceWritten) {
        logForDebugging(
          '[Perfetto] exit handler invoked, writing trace synchronously',
        )
        writePerfettoTraceSync()
      }
    })

    // Emit process metadata events for main process
    const mainAgent = getCurrentAgentInfo()
    emitProcessMetadata(mainAgent)
  }
}

/**
 * Emit metadata events for a process/agent
 */
function emitProcessMetadata(agentInfo: AgentInfo): void {
  if (!isEnabled) return

  // Process name
  metadataEvents.push({
    name: 'process_name',
    cat: '__metadata',
    ph: 'M',
    ts: 0,
    pid: agentInfo.processId,
    tid: 0,
    args: { name: agentInfo.agentName },
  })

  // Thread name (same as process for now)
  metadataEvents.push({
    name: 'thread_name',
    cat: '__metadata',
    ph: 'M',
    ts: 0,
    pid: agentInfo.processId,
    tid: agentInfo.threadId,
    args: { name: agentInfo.agentName },
  })

  // Add parent info if available
  if (agentInfo.parentAgentId) {
    metadataEvents.push({
      name: 'parent_agent',
      cat: '__metadata',
      ph: 'M',
      ts: 0,
      pid: agentInfo.processId,
      tid: 0,
      args: {
        parent_agent_id: agentInfo.parentAgentId,
      },
    })
  }
}

/**
 * Check if Perfetto tracing is enabled
 */
export function isPerfettoTracingEnabled(): boolean {
  return isEnabled
}

/**
 * Register a new agent in the trace
 * Call this when a subagent/teammate is spawned
 */
export function registerAgent(
  agentId: string,
  agentName: string,
  parentAgentId?: string,
): void {
  if (!isEnabled) return

  const info: AgentInfo = {
    agentId,
    agentName,
    parentAgentId,
    processId: getProcessIdForAgent(agentId),
    threadId: stringToNumericHash(agentName),
  }

  agentRegistry.set(agentId, info)
  totalAgentCount++
  emitProcessMetadata(info)
}

/**
 * Unregister an agent from the trace.
 * Call this when an agent completes, fails, or is aborted to free memory.
 */
export function unregisterAgent(agentId: string): void {
  if (!isEnabled) return
  agentRegistry.delete(agentId)
  agentIdToProcessId.delete(agentId)
}

/**
 * Start an API call span
 */
export function startLLMRequestPerfettoSpan(args: {
  model: string
  promptTokens?: number
  messageId?: string
  isSpeculative?: boolean
  querySource?: string
}): string {
  if (!isEnabled) return ''

  const spanId = generateSpanId()
  const agentInfo = getCurrentAgentInfo()

  pendingSpans.set(spanId, {
    name: 'API Call',
    category: 'api',
    startTime: getTimestamp(),
    agentInfo,
    args: {
      model: args.model,
      prompt_tokens: args.promptTokens,
      message_id: args.messageId,
      is_speculative: args.isSpeculative ?? false,
      query_source: args.querySource,
    },
  })

  // Emit begin event
  events.push({
    name: 'API Call',
    cat: 'api',
    ph: 'B',
    ts: pendingSpans.get(spanId)!.startTime,
    pid: agentInfo.processId,
    tid: agentInfo.threadId,
    args: pendingSpans.get(spanId)!.args,
  })

  return spanId
}

/**
 * End an API call span with response metadata
 */
export function endLLMRequestPerfettoSpan(
  spanId: string,
  metadata: {
    ttftMs?: number
    ttltMs?: number
    promptTokens?: number
    outputTokens?: number
    cacheReadTokens?: number
    cacheCreationTokens?: number
    messageId?: string
    success?: boolean
    error?: string
    /** Time spent in pre-request setup (client creation, retries) before the successful attempt */
    requestSetupMs?: number
    /** Timestamps (Date.now()) of each attempt start — used to emit retry sub-spans */
    attemptStartTimes?: number[]
  },
): void {
  if (!isEnabled || !spanId) return

  const pending = pendingSpans.get(spanId)
  if (!pending) return

  const endTime = getTimestamp()
  const duration = endTime - pending.startTime

  const promptTokens =
    metadata.promptTokens ?? (pending.args.prompt_tokens as number | undefined)
  const ttftMs = metadata.ttftMs
  const ttltMs = metadata.ttltMs
  const outputTokens = metadata.outputTokens
  const cacheReadTokens = metadata.cacheReadTokens

  // Compute derived metrics
  // ITPS: input tokens per second (prompt processing speed)
  const itps =
    ttftMs !== undefined && promptTokens !== undefined && ttftMs > 0
      ? Math.round((promptTokens / (ttftMs / 1000)) * 100) / 100
      : undefined

  // OTPS: output tokens per second (sampling speed)
  const samplingMs =
    ttltMs !== undefined && ttftMs !== undefined ? ttltMs - ttftMs : undefined
  const otps =
    samplingMs !== undefined && outputTokens !== undefined && samplingMs > 0
      ? Math.round((outputTokens / (samplingMs / 1000)) * 100) / 100
      : undefined

  // Cache hit rate: percentage of prompt tokens from cache
  const cacheHitRate =
    cacheReadTokens !== undefined &&
    promptTokens !== undefined &&
    promptTokens > 0
      ? Math.round((cacheReadTokens / promptTokens) * 10000) / 100
      : undefined

  const requestSetupMs = metadata.requestSetupMs
  const attemptStartTimes = metadata.attemptStartTimes

  // Merge metadata with original args
  const args = {
    ...pending.args,
    ttft_ms: ttftMs,
    ttlt_ms: ttltMs,
    prompt_tokens: promptTokens,
    output_tokens: outputTokens,
    cache_read_tokens: cacheReadTokens,
    cache_creation_tokens: metadata.cacheCreationTokens,
    message_id: metadata.messageId ?? pending.args.message_id,
    success: metadata.success ?? true,
    error: metadata.error,
    duration_ms: duration / 1000,
    request_setup_ms: requestSetupMs,
    // Derived metrics
    itps,
    otps,
    cache_hit_rate_pct: cacheHitRate,
  }

  // Emit Request Setup sub-span when there was measurable setup time
  // (client creation, param building, retries before the successful attempt)
  const setupUs =
    requestSetupMs !== undefined && requestSetupMs > 0
      ? requestSetupMs * 1000
      : 0
  if (setupUs > 0) {
    const setupEndTs = pending.startTime + setupUs

    events.push({
      name: 'Request Setup',
      cat: 'api,setup',
      ph: 'B',
      ts: pending.startTime,
      pid: pending.agentInfo.processId,
      tid: pending.agentInfo.threadId,
      args: {
        request_setup_ms: requestSetupMs,
        attempt_count: attemptStartTimes?.length ?? 1,
      },
    })

    // Emit retry attempt sub-spans within Request Setup.
    // Each failed attempt runs from its start to the next attempt's start.
    if (attemptStartTimes && attemptStartTimes.length > 1) {
      // attemptStartTimes[0] is the reference point (first attempt).
      // Convert wall-clock deltas into Perfetto-relative microseconds.
      const baseWallMs = attemptStartTimes[0]!
      for (let i = 0; i < attemptStartTimes.length - 1; i++) {
        const attemptStartUs =
          pending.startTime + (attemptStartTimes[i]! - baseWallMs) * 1000
        const attemptEndUs =
          pending.startTime + (attemptStartTimes[i + 1]! - baseWallMs) * 1000

        events.push({
          name: `Attempt ${i + 1} (retry)`,
          cat: 'api,retry',
          ph: 'B',
          ts: attemptStartUs,
          pid: pending.agentInfo.processId,
          tid: pending.agentInfo.threadId,
          args: { attempt: i + 1 },
        })
        events.push({
          name: `Attempt ${i + 1} (retry)`,
          cat: 'api,retry',
          ph: 'E',
          ts: attemptEndUs,
          pid: pending.agentInfo.processId,
          tid: pending.agentInfo.threadId,
        })
      }
    }

    events.push({
      name: 'Request Setup',
      cat: 'api,setup',
      ph: 'E',
      ts: setupEndTs,
      pid: pending.agentInfo.processId,
      tid: pending.agentInfo.threadId,
    })
  }

  // Emit sub-spans for First Token and Sampling phases (before API Call end)
  // Using B/E pairs in proper nesting order for correct Perfetto visualization
  if (ttftMs !== undefined) {
    // First Token starts after request setup (if any)
    const firstTokenStartTs = pending.startTime + setupUs
    const firstTokenEndTs = firstTokenStartTs + ttftMs * 1000

    // First Token phase: from successful attempt start to first token
    events.push({
      name: 'First Token',
      cat: 'api,ttft',
      ph: 'B',
      ts: firstTokenStartTs,
      pid: pending.agentInfo.processId,
      tid: pending.agentInfo.threadId,
      args: {
        ttft_ms: ttftMs,
        prompt_tokens: promptTokens,
        itps,
        cache_hit_rate_pct: cacheHitRate,
      },
    })
    events.push({
      name: 'First Token',
      cat: 'api,ttft',
      ph: 'E',
      ts: firstTokenEndTs,
      pid: pending.agentInfo.processId,
      tid: pending.agentInfo.threadId,
    })

    // Sampling phase: from first token to last token
    // Note: samplingMs = ttltMs - ttftMs still includes setup time in ttltMs,
    // so we compute the actual sampling duration for the span as the time from
    // first token to API call end (endTime), not samplingMs directly.
    const actualSamplingMs =
      ttltMs !== undefined ? ttltMs - ttftMs - setupUs / 1000 : undefined
    if (actualSamplingMs !== undefined && actualSamplingMs > 0) {
      events.push({
        name: 'Sampling',
        cat: 'api,sampling',
        ph: 'B',
        ts: firstTokenEndTs,
        pid: pending.agentInfo.processId,
        tid: pending.agentInfo.threadId,
        args: {
          sampling_ms: actualSamplingMs,
          output_tokens: outputTokens,
          otps,
        },
      })
      events.push({
        name: 'Sampling',
        cat: 'api,sampling',
        ph: 'E',
        ts: firstTokenEndTs + actualSamplingMs * 1000,
        pid: pending.agentInfo.processId,
        tid: pending.agentInfo.threadId,
      })
    }
  }

  // Emit API Call end event (after sub-spans)
  events.push({
    name: pending.name,
    cat: pending.category,
    ph: 'E',
    ts: endTime,
    pid: pending.agentInfo.processId,
    tid: pending.agentInfo.threadId,
    args,
  })

  pendingSpans.delete(spanId)
}

/**
 * Start a tool execution span
 */
export function startToolPerfettoSpan(
  toolName: string,
  args?: Record<string, unknown>,
): string {
  if (!isEnabled) return ''

  const spanId = generateSpanId()
  const agentInfo = getCurrentAgentInfo()

  pendingSpans.set(spanId, {
    name: `Tool: ${toolName}`,
    category: 'tool',
    startTime: getTimestamp(),
    agentInfo,
    args: {
      tool_name: toolName,
      ...args,
    },
  })

  // Emit begin event
  events.push({
    name: `Tool: ${toolName}`,
    cat: 'tool',
    ph: 'B',
    ts: pendingSpans.get(spanId)!.startTime,
    pid: agentInfo.processId,
    tid: agentInfo.threadId,
    args: pendingSpans.get(spanId)!.args,
  })

  return spanId
}

/**
 * End a tool execution span
 */
export function endToolPerfettoSpan(
  spanId: string,
  metadata?: {
    success?: boolean
    error?: string
    resultTokens?: number
  },
): void {
  if (!isEnabled || !spanId) return

  const pending = pendingSpans.get(spanId)
  if (!pending) return

  const endTime = getTimestamp()
  const duration = endTime - pending.startTime

  const args = {
    ...pending.args,
    success: metadata?.success ?? true,
    error: metadata?.error,
    result_tokens: metadata?.resultTokens,
    duration_ms: duration / 1000,
  }

  // Emit end event
  events.push({
    name: pending.name,
    cat: pending.category,
    ph: 'E',
    ts: endTime,
    pid: pending.agentInfo.processId,
    tid: pending.agentInfo.threadId,
    args,
  })

  pendingSpans.delete(spanId)
}

/**
 * Start a user input waiting span
 */
export function startUserInputPerfettoSpan(context?: string): string {
  if (!isEnabled) return ''

  const spanId = generateSpanId()
  const agentInfo = getCurrentAgentInfo()

  pendingSpans.set(spanId, {
    name: 'Waiting for User Input',
    category: 'user_input',
    startTime: getTimestamp(),
    agentInfo,
    args: {
      context,
    },
  })

  // Emit begin event
  events.push({
    name: 'Waiting for User Input',
    cat: 'user_input',
    ph: 'B',
    ts: pendingSpans.get(spanId)!.startTime,
    pid: agentInfo.processId,
    tid: agentInfo.threadId,
    args: pendingSpans.get(spanId)!.args,
  })

  return spanId
}

/**
 * End a user input waiting span
 */
export function endUserInputPerfettoSpan(
  spanId: string,
  metadata?: {
    decision?: string
    source?: string
  },
): void {
  if (!isEnabled || !spanId) return

  const pending = pendingSpans.get(spanId)
  if (!pending) return

  const endTime = getTimestamp()
  const duration = endTime - pending.startTime

  const args = {
    ...pending.args,
    decision: metadata?.decision,
    source: metadata?.source,
    duration_ms: duration / 1000,
  }

  // Emit end event
  events.push({
    name: pending.name,
    cat: pending.category,
    ph: 'E',
    ts: endTime,
    pid: pending.agentInfo.processId,
    tid: pending.agentInfo.threadId,
    args,
  })

  pendingSpans.delete(spanId)
}

/**
 * Emit an instant event (marker)
 */
export function emitPerfettoInstant(
  name: string,
  category: string,
  args?: Record<string, unknown>,
): void {
  if (!isEnabled) return

  const agentInfo = getCurrentAgentInfo()

  events.push({
    name,
    cat: category,
    ph: 'i',
    ts: getTimestamp(),
    pid: agentInfo.processId,
    tid: agentInfo.threadId,
    args,
  })
}

/**
 * Emit a counter event for tracking metrics over time
 */
export function emitPerfettoCounter(
  name: string,
  values: Record<string, number>,
): void {
  if (!isEnabled) return

  const agentInfo = getCurrentAgentInfo()

  events.push({
    name,
    cat: 'counter',
    ph: 'C',
    ts: getTimestamp(),
    pid: agentInfo.processId,
    tid: agentInfo.threadId,
    args: values,
  })
}

/**
 * Start an interaction span (wraps a full user request cycle)
 */
export function startInteractionPerfettoSpan(userPrompt?: string): string {
  if (!isEnabled) return ''

  const spanId = generateSpanId()
  const agentInfo = getCurrentAgentInfo()

  pendingSpans.set(spanId, {
    name: 'Interaction',
    category: 'interaction',
    startTime: getTimestamp(),
    agentInfo,
    args: {
      user_prompt_length: userPrompt?.length,
    },
  })

  // Emit begin event
  events.push({
    name: 'Interaction',
    cat: 'interaction',
    ph: 'B',
    ts: pendingSpans.get(spanId)!.startTime,
    pid: agentInfo.processId,
    tid: agentInfo.threadId,
    args: pendingSpans.get(spanId)!.args,
  })

  return spanId
}

/**
 * End an interaction span
 */
export function endInteractionPerfettoSpan(spanId: string): void {
  if (!isEnabled || !spanId) return

  const pending = pendingSpans.get(spanId)
  if (!pending) return

  const endTime = getTimestamp()
  const duration = endTime - pending.startTime

  // Emit end event
  events.push({
    name: pending.name,
    cat: pending.category,
    ph: 'E',
    ts: endTime,
    pid: pending.agentInfo.processId,
    tid: pending.agentInfo.threadId,
    args: {
      ...pending.args,
      duration_ms: duration / 1000,
    },
  })

  pendingSpans.delete(spanId)
}

// ---------------------------------------------------------------------------
// Periodic write helpers
// ---------------------------------------------------------------------------

/**
 * Stop the periodic write timer.
 */
function stopWriteInterval(): void {
  if (staleSpanCleanupId) {
    clearInterval(staleSpanCleanupId)
    staleSpanCleanupId = null
  }
  if (writeIntervalId) {
    clearInterval(writeIntervalId)
    writeIntervalId = null
  }
}

/**
 * Force-close any remaining open spans at session end.
 */
function closeOpenSpans(): void {
  for (const [spanId, pending] of pendingSpans) {
    const endTime = getTimestamp()
    events.push({
      name: pending.name,
      cat: pending.category,
      ph: 'E',
      ts: endTime,
      pid: pending.agentInfo.processId,
      tid: pending.agentInfo.threadId,
      args: {
        ...pending.args,
        incomplete: true,
        duration_ms: (endTime - pending.startTime) / 1000,
      },
    })
    pendingSpans.delete(spanId)
  }
}

/**
 * Write the full trace to disk.  Errors are logged but swallowed so that a
 * transient I/O problem does not crash the session — the next periodic tick
 * (or the final exit write) will retry with a complete snapshot.
 */
async function periodicWrite(): Promise<void> {
  if (!isEnabled || !tracePath || traceWritten) return

  try {
    await mkdir(dirname(tracePath), { recursive: true })
    await writeFile(tracePath, buildTraceDocument())
    logForDebugging(
      `[Perfetto] Periodic write: ${events.length} events to ${tracePath}`,
    )
  } catch (error) {
    logForDebugging(
      `[Perfetto] Periodic write failed: ${errorMessage(error)}`,
      { level: 'error' },
    )
  }
}

/**
 * Final async write: close open spans and write the complete trace.
 * Idempotent — sets `traceWritten` on success so subsequent calls are no-ops.
 */
async function writePerfettoTrace(): Promise<void> {
  if (!isEnabled || !tracePath || traceWritten) {
    logForDebugging(
      `[Perfetto] Skipping final write: isEnabled=${isEnabled}, tracePath=${tracePath}, traceWritten=${traceWritten}`,
    )
    return
  }

  stopWriteInterval()
  closeOpenSpans()

  logForDebugging(
    `[Perfetto] writePerfettoTrace called: events=${events.length}`,
  )

  try {
    await mkdir(dirname(tracePath), { recursive: true })
    await writeFile(tracePath, buildTraceDocument())
    traceWritten = true
    logForDebugging(`[Perfetto] Trace finalized at: ${tracePath}`)
  } catch (error) {
    logForDebugging(
      `[Perfetto] Failed to write final trace: ${errorMessage(error)}`,
      { level: 'error' },
    )
  }
}

/**
 * Final synchronous write (fallback for process 'exit' handler where async is forbidden).
 */
function writePerfettoTraceSync(): void {
  if (!isEnabled || !tracePath || traceWritten) {
    logForDebugging(
      `[Perfetto] Skipping final sync write: isEnabled=${isEnabled}, tracePath=${tracePath}, traceWritten=${traceWritten}`,
    )
    return
  }

  stopWriteInterval()
  closeOpenSpans()

  logForDebugging(
    `[Perfetto] writePerfettoTraceSync called: events=${events.length}`,
  )

  try {
    const dir = dirname(tracePath)
    // eslint-disable-next-line custom-rules/no-sync-fs -- Only called from process.on('exit') handler
    mkdirSync(dir, { recursive: true })
    // eslint-disable-next-line custom-rules/no-sync-fs, eslint-plugin-n/no-sync -- Required for process 'exit' handler which doesn't support async
    writeFileSync(tracePath, buildTraceDocument())
    traceWritten = true
    logForDebugging(`[Perfetto] Trace finalized synchronously at: ${tracePath}`)
  } catch (error) {
    logForDebugging(
      `[Perfetto] Failed to write final trace synchronously: ${errorMessage(error)}`,
      { level: 'error' },
    )
  }
}

/**
 * Get all recorded events (for testing)
 */
export function getPerfettoEvents(): TraceEvent[] {
  return [...metadataEvents, ...events]
}

/**
 * Reset the tracer state (for testing)
 */
export function resetPerfettoTracer(): void {
  if (staleSpanCleanupId) {
    clearInterval(staleSpanCleanupId)
    staleSpanCleanupId = null
  }
  stopWriteInterval()
  metadataEvents.length = 0
  events.length = 0
  pendingSpans.clear()
  agentRegistry.clear()
  agentIdToProcessId.clear()
  totalAgentCount = 0
  processIdCounter = 1
  spanIdCounter = 0
  isEnabled = false
  tracePath = null
  startTimeMs = 0
  traceWritten = false
}

/**
 * Trigger a periodic write immediately (for testing)
 */
export async function triggerPeriodicWriteForTesting(): Promise<void> {
  await periodicWrite()
}

/**
 * Evict stale spans immediately (for testing)
 */
export function evictStaleSpansForTesting(): void {
  evictStaleSpans()
}

export const MAX_EVENTS_FOR_TESTING = MAX_EVENTS
export function evictOldestEventsForTesting(): void {
  evictOldestEvents()
}
