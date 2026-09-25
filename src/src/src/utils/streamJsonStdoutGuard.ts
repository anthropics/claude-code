import { registerCleanup } from './cleanupRegistry.js'
import { logForDebugging } from './debug.js'

/**
 * Sentinel written to stderr ahead of any diverted non-JSON line, so that
 * log scrapers and tests can grep for guard activity.
 */
export const STDOUT_GUARD_MARKER = '[stdout-guard]'

let installed = false
let buffer = ''
let originalWrite: typeof process.stdout.write | null = null

function isJsonLine(line: string): boolean {
  // Empty lines are tolerated in NDJSON streams — treat them as valid so a
  // trailing newline or a blank separator doesn't trip the guard.
  if (line.length === 0) {
    return true
  }
  try {
    JSON.parse(line)
    return true
  } catch {
    return false
  }
}

/**
 * Install a runtime guard on process.stdout.write for --output-format=stream-json.
 *
 * SDK clients consuming stream-json parse stdout line-by-line as NDJSON. Any
 * stray write — a console.log from a dependency, a debug print that slipped
 * past review, a library banner — breaks the client's parser mid-stream with
 * no recovery path.
 *
 * This guard wraps process.stdout.write at the same layer the asciicast
 * recorder does (see asciicast.ts). Writes are buffered until a newline
 * arrives, then each complete line is JSON-parsed. Lines that parse are
 * forwarded to the real stdout; lines that don't are diverted to stderr
 * tagged with STDOUT_GUARD_MARKER so they remain visible without corrupting
 * the JSON stream.
 *
 * The blessed JSON path (structuredIO.write → writeToStdout → stdout.write)
 * always emits `ndjsonSafeStringify(msg) + '\n'`, so it passes straight
 * through. Only out-of-band writes are diverted.
 *
 * Installing twice is a no-op. Call before any stream-json output is emitted.
 */
export function installStreamJsonStdoutGuard(): void {
  if (installed) {
    return
  }
  installed = true

  originalWrite = process.stdout.write.bind(
    process.stdout,
  ) as typeof process.stdout.write

  process.stdout.write = function (
    chunk: string | Uint8Array,
    encodingOrCb?: BufferEncoding | ((err?: Error) => void),
    cb?: (err?: Error) => void,
  ): boolean {
    const text =
      typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8')

    buffer += text
    let newlineIdx: number
    let wrote = true
    while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIdx)
      buffer = buffer.slice(newlineIdx + 1)
      if (isJsonLine(line)) {
        wrote = originalWrite!(line + '\n')
      } else {
        process.stderr.write(`${STDOUT_GUARD_MARKER} ${line}\n`)
        logForDebugging(
          `streamJsonStdoutGuard diverted non-JSON stdout line: ${line.slice(0, 200)}`,
        )
      }
    }

    // Fire the callback once buffering is done. We report success even when
    // a line was diverted — the caller's intent (emit text) was honored,
    // just on a different fd.
    const callback = typeof encodingOrCb === 'function' ? encodingOrCb : cb
    if (callback) {
      queueMicrotask(() => callback())
    }
    return wrote
  } as typeof process.stdout.write

  registerCleanup(async () => {
    // Flush any partial line left in the buffer at shutdown. If it's a JSON
    // fragment it won't parse — divert it rather than drop it silently.
    if (buffer.length > 0) {
      if (originalWrite && isJsonLine(buffer)) {
        originalWrite(buffer + '\n')
      } else {
        process.stderr.write(`${STDOUT_GUARD_MARKER} ${buffer}\n`)
      }
      buffer = ''
    }
    if (originalWrite) {
      process.stdout.write = originalWrite
      originalWrite = null
    }
    installed = false
  })
}

/**
 * Testing-only reset. Restores the real stdout.write and clears the line
 * buffer so subsequent tests start from a clean slate.
 */
export function _resetStreamJsonStdoutGuardForTesting(): void {
  if (originalWrite) {
    process.stdout.write = originalWrite
    originalWrite = null
  }
  buffer = ''
  installed = false
}
