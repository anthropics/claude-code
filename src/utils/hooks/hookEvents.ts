/**
 * Hook event system for broadcasting hook execution events.
 *
 * This module provides a generic event system that is separate from the
 * main message stream. Handlers can register to receive events and decide
 * what to do with them (e.g., convert to SDK messages, log, etc.).
 */

import { HOOK_EVENTS } from 'src/entrypoints/sdk/coreTypes.js'

import { logForDebugging } from '../debug.js'

/**
 * Hook events that are always emitted regardless of the includeHookEvents
 * option. These are low-noise lifecycle events that were in the original
 * allowlist and are backwards-compatible.
 */
const ALWAYS_EMITTED_HOOK_EVENTS = ['SessionStart', 'Setup'] as const

const MAX_PENDING_EVENTS = 100

export type HookStartedEvent = {
  type: 'started'
  hookId: string
  hookName: string
  hookEvent: string
}

export type HookProgressEvent = {
  type: 'progress'
  hookId: string
  hookName: string
  hookEvent: string
  stdout: string
  stderr: string
  output: string
}

export type HookResponseEvent = {
  type: 'response'
  hookId: string
  hookName: string
  hookEvent: string
  output: string
  stdout: string
  stderr: string
  exitCode?: number
  outcome: 'success' | 'error' | 'cancelled'
}

export type HookExecutionEvent =
  | HookStartedEvent
  | HookProgressEvent
  | HookResponseEvent
export type HookEventHandler = (event: HookExecutionEvent) => void

const pendingEvents: HookExecutionEvent[] = []
let eventHandler: HookEventHandler | null = null
let allHookEventsEnabled = false

export function registerHookEventHandler(
  handler: HookEventHandler | null,
): void {
  eventHandler = handler
  if (handler && pendingEvents.length > 0) {
    for (const event of pendingEvents.splice(0)) {
      handler(event)
    }
  }
}

function emit(event: HookExecutionEvent): void {
  if (eventHandler) {
    eventHandler(event)
  } else {
    pendingEvents.push(event)
    if (pendingEvents.length > MAX_PENDING_EVENTS) {
      pendingEvents.shift()
    }
  }
}

function shouldEmit(hookEvent: string): boolean {
  if ((ALWAYS_EMITTED_HOOK_EVENTS as readonly string[]).includes(hookEvent)) {
    return true
  }
  return (
    allHookEventsEnabled &&
    (HOOK_EVENTS as readonly string[]).includes(hookEvent)
  )
}

export function emitHookStarted(
  hookId: string,
  hookName: string,
  hookEvent: string,
): void {
  if (!shouldEmit(hookEvent)) return

  emit({
    type: 'started',
    hookId,
    hookName,
    hookEvent,
  })
}

export function emitHookProgress(data: {
  hookId: string
  hookName: string
  hookEvent: string
  stdout: string
  stderr: string
  output: string
}): void {
  if (!shouldEmit(data.hookEvent)) return

  emit({
    type: 'progress',
    ...data,
  })
}

export function startHookProgressInterval(params: {
  hookId: string
  hookName: string
  hookEvent: string
  getOutput: () => Promise<{ stdout: string; stderr: string; output: string }>
  intervalMs?: number
}): () => void {
  if (!shouldEmit(params.hookEvent)) return () => {}

  let lastEmittedOutput = ''
  const interval = setInterval(() => {
    void params.getOutput().then(({ stdout, stderr, output }) => {
      if (output === lastEmittedOutput) return
      lastEmittedOutput = output
      emitHookProgress({
        hookId: params.hookId,
        hookName: params.hookName,
        hookEvent: params.hookEvent,
        stdout,
        stderr,
        output,
      })
    })
  }, params.intervalMs ?? 1000)
  interval.unref()

  return () => clearInterval(interval)
}

export function emitHookResponse(data: {
  hookId: string
  hookName: string
  hookEvent: string
  output: string
  stdout: string
  stderr: string
  exitCode?: number
  outcome: 'success' | 'error' | 'cancelled'
}): void {
  // Always log full hook output to debug log for verbose mode debugging
  const outputToLog = data.stdout || data.stderr || data.output
  if (outputToLog) {
    logForDebugging(
      `Hook ${data.hookName} (${data.hookEvent}) ${data.outcome}:\n${outputToLog}`,
    )
  }

  if (!shouldEmit(data.hookEvent)) return

  emit({
    type: 'response',
    ...data,
  })
}

/**
 * Enable emission of all hook event types (beyond SessionStart and Setup).
 * Called when the SDK `includeHookEvents` option is set or when running
 * in CLAUDE_CODE_REMOTE mode.
 */
export function setAllHookEventsEnabled(enabled: boolean): void {
  allHookEventsEnabled = enabled
}

export function clearHookEventState(): void {
  eventHandler = null
  pendingEvents.length = 0
  allHookEventsEnabled = false
}
