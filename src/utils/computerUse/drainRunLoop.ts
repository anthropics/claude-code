import { logForDebugging } from '../debug.js'
import { withResolvers } from '../withResolvers.js'
import { requireComputerUseSwift } from './swiftLoader.js'

/**
 * Shared CFRunLoop pump. Swift's four `@MainActor` async methods
 * (captureExcluding, captureRegion, apps.listInstalled, resolvePrepareCapture)
 * and `@ant/computer-use-input`'s key()/keys() all dispatch to
 * DispatchQueue.main. Under libuv (Node/bun) that queue never drains — the
 * promises hang. Electron drains it via CFRunLoop so Cowork doesn't need this.
 *
 * One refcounted setInterval calls `_drainMainRunLoop` (RunLoop.main.run)
 * every 1ms while any main-queue-dependent call is pending. Multiple
 * concurrent drainRunLoop() calls share the single pump via retain/release.
 */

let pump: ReturnType<typeof setInterval> | undefined
let pending = 0

function drainTick(cu: ReturnType<typeof requireComputerUseSwift>): void {
  cu._drainMainRunLoop()
}

function retain(): void {
  pending++
  if (pump === undefined) {
    pump = setInterval(drainTick, 1, requireComputerUseSwift())
    logForDebugging('[drainRunLoop] pump started', { level: 'verbose' })
  }
}

function release(): void {
  pending--
  if (pending <= 0 && pump !== undefined) {
    clearInterval(pump)
    pump = undefined
    logForDebugging('[drainRunLoop] pump stopped', { level: 'verbose' })
    pending = 0
  }
}

const TIMEOUT_MS = 30_000

function timeoutReject(reject: (e: Error) => void): void {
  reject(new Error(`computer-use native call exceeded ${TIMEOUT_MS}ms`))
}

/**
 * Hold a pump reference for the lifetime of a long-lived registration
 * (e.g. the CGEventTap Escape handler). Unlike `drainRunLoop(fn)` this has
 * no timeout — the caller is responsible for calling `releasePump()`. Same
 * refcount as drainRunLoop calls, so nesting is safe.
 */
export const retainPump = retain
export const releasePump = release

/**
 * Await `fn()` with the shared drain pump running. Safe to nest — multiple
 * concurrent drainRunLoop() calls share one setInterval.
 */
export async function drainRunLoop<T>(fn: () => Promise<T>): Promise<T> {
  retain()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    // If the timeout wins the race, fn()'s promise is orphaned — a late
    // rejection from the native layer would become an unhandledRejection.
    // Attaching a no-op catch swallows it; the timeout error is what surfaces.
    // fn() sits inside try so a synchronous throw (e.g. NAPI argument
    // validation) still reaches release() — otherwise the pump leaks.
    const work = fn()
    work.catch(() => {})
    const timeout = withResolvers<never>()
    timer = setTimeout(timeoutReject, TIMEOUT_MS, timeout.reject)
    return await Promise.race([work, timeout.promise])
  } finally {
    clearTimeout(timer)
    release()
  }
}
