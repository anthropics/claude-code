/**
 * Turn-scoped workload tag via AsyncLocalStorage.
 *
 * WHY a separate module from bootstrap/state.ts:
 * bootstrap is transitively imported by src/entrypoints/browser-sdk.ts, and
 * the browser bundle cannot import Node's async_hooks. This module is only
 * imported from CLI/SDK code paths that never end up in the browser build.
 *
 * WHY AsyncLocalStorage (not a global mutable slot):
 * void-detached background agents (executeForkedSlashCommand, AgentTool)
 * yield at their first await. The parent turn's synchronous continuation —
 * including any `finally` block — runs to completion BEFORE the detached
 * closure resumes. A global setWorkload('cron') at the top of the closure
 * is deterministically clobbered. ALS captures context at invocation time
 * and survives every await in that chain, isolated from the parent. Same
 * pattern as agentContext.ts.
 */

import { AsyncLocalStorage } from 'async_hooks'

/**
 * Server-side sanitizer (_sanitize_entrypoint in claude_code.py) accepts
 * only lowercase [a-z0-9_-]{0,32}. Uppercase stops parsing at char 0.
 */
export type Workload = 'cron'
export const WORKLOAD_CRON: Workload = 'cron'

const workloadStorage = new AsyncLocalStorage<{
  workload: string | undefined
}>()

export function getWorkload(): string | undefined {
  return workloadStorage.getStore()?.workload
}

/**
 * Wrap `fn` in a workload ALS context. ALWAYS establishes a new context
 * boundary, even when `workload` is undefined.
 *
 * The previous implementation short-circuited on `undefined` with
 * `return fn()` — but that's a pass-through, not a boundary. If the caller
 * is already inside a leaked cron context (REPL: queryGuard.end() →
 * _notify() → React subscriber → scheduled re-render captures ALS at
 * scheduling time → useQueueProcessor effect → executeQueuedInput → here),
 * a pass-through lets `getWorkload()` inside `fn` return the leaked tag.
 * Once leaked, it's sticky forever: every turn's end-notify re-propagates
 * the ambient context to the next turn's scheduling chain.
 *
 * Always calling `.run()` guarantees `getWorkload()` inside `fn` returns
 * exactly what the caller passed — including `undefined`.
 */
export function runWithWorkload<T>(
  workload: string | undefined,
  fn: () => T,
): T {
  return workloadStorage.run({ workload }, fn)
}
