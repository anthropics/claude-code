import { logForDebugging } from '../debug.js'
import { releasePump, retainPump } from './drainRunLoop.js'
import { requireComputerUseSwift } from './swiftLoader.js'

/**
 * Global Escape → abort. Mirrors Cowork's `escAbort.ts` but without Electron:
 * CGEventTap via `@ant/computer-use-swift`. While registered, Escape is
 * consumed system-wide (PI defense — a prompt-injected action can't dismiss
 * a dialog with Escape).
 *
 * Lifecycle: register on fresh lock acquire (`wrapper.tsx` `acquireCuLock`),
 * unregister on lock release (`cleanup.ts`). The tap's CFRunLoopSource sits
 * in .defaultMode on CFRunLoopGetMain(), so we hold a drainRunLoop pump
 * retain for the registration's lifetime — same refcounted setInterval as
 * the `@MainActor` methods.
 *
 * `notifyExpectedEscape()` punches a hole for model-synthesized Escapes: the
 * executor's `key("escape")` calls it before posting the CGEvent. Swift
 * schedules a 100ms decay so a CGEvent that never reaches the tap callback
 * doesn't eat the next user ESC.
 */

let registered = false

export function registerEscHotkey(onEscape: () => void): boolean {
  if (registered) return true
  const cu = requireComputerUseSwift()
  if (!cu.hotkey.registerEscape(onEscape)) {
    // CGEvent.tapCreate failed — typically missing Accessibility permission.
    // CU still works, just without ESC abort. Mirrors Cowork's escAbort.ts:81.
    logForDebugging('[cu-esc] registerEscape returned false', { level: 'warn' })
    return false
  }
  retainPump()
  registered = true
  logForDebugging('[cu-esc] registered')
  return true
}

export function unregisterEscHotkey(): void {
  if (!registered) return
  try {
    requireComputerUseSwift().hotkey.unregister()
  } finally {
    releasePump()
    registered = false
    logForDebugging('[cu-esc] unregistered')
  }
}

export function notifyExpectedEscape(): void {
  if (!registered) return
  requireComputerUseSwift().hotkey.notifyExpectedEscape()
}
