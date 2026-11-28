import { appendFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { getProjectRoot, getSessionId } from './bootstrap/state.js'
import { registerCleanup } from './utils/cleanupRegistry.js'
import type { HistoryEntry, PastedContent } from './utils/config.js'
import { logForDebugging } from './utils/debug.js'
import { getClaudeConfigHomeDir, isEnvTruthy } from './utils/envUtils.js'
import { getErrnoCode } from './utils/errors.js'
import { readLinesReverse } from './utils/fsOperations.js'
import { lock } from './utils/lockfile.js'
import {
  hashPastedText,
  retrievePastedText,
  storePastedText,
} from './utils/pasteStore.js'
import { sleep } from './utils/sleep.js'
import { jsonParse, jsonStringify } from './utils/slowOperations.js'

const MAX_HISTORY_ITEMS = 100
const MAX_PASTED_CONTENT_LENGTH = 1024

/**
 * Stored paste content - either inline content or a hash reference to paste store.
 */
type StoredPastedContent = {
  id: number
  type: 'text' | 'image'
  content?: string // Inline content for small pastes
  contentHash?: string // Hash reference for large pastes stored externally
  mediaType?: string
  filename?: string
}

/**
 * Claude Code parses history for pasted content references to match back to
 * pasted content. The references look like:
 *   Text: [Pasted text #1 +10 lines]
 *   Image: [Image #2]
 * The numbers are expected to be unique within a single prompt but not across
 * prompts. We choose numeric, auto-incrementing IDs as they are more
 * user-friendly than other ID options.
 */

// Note: The original text paste implementation would consider input like
// "line1\nline2\nline3" to have +2 lines, not 3 lines. We preserve that
// behavior here.
export function getPastedTextRefNumLines(text: string): number {
  return (text.match(/\r\n|\r|\n/g) || []).length
}

export function formatPastedTextRef(id: number, numLines: number): string {
  if (numLines === 0) {
    return `[Pasted text #${id}]`
  }
  return `[Pasted text #${id} +${numLines} lines]`
}

export function formatImageRef(id: number): string {
  return `[Image #${id}]`
}

export function parseReferences(
  input: string,
): Array<{ id: number; match: string; index: number }> {
  const referencePattern =
    /\[(Pasted text|Image|\.\.\.Truncated text) #(\d+)(?: \+\d+ lines)?(\.)*\]/g
  const matches = [...input.matchAll(referencePattern)]
  return matches
    .map(match => ({
      id: parseInt(match[2] || '0'),
      match: match[0],
      index: match.index,
    }))
    .filter(match => match.id > 0)
}

/**
 * Replace [Pasted text #N] placeholders in input with their actual content.
 * Image refs are left alone — they become content blocks, not inlined text.
 */
export function expandPastedTextRefs(
  input: string,
  pastedContents: Record<number, PastedContent>,
): string {
  const refs = parseReferences(input)
  let expanded = input
  // Splice at the original match offsets so placeholder-like strings inside
  // pasted content are never confused for real refs. Reverse order keeps
  // earlier offsets valid after later replacements.
  for (let i = refs.length - 1; i >= 0; i--) {
    const ref = refs[i]!
    const content = pastedContents[ref.id]
    if (content?.type !== 'text') continue
    expanded =
      expanded.slice(0, ref.index) +
      content.content +
      expanded.slice(ref.index + ref.match.length)
  }
  return expanded
}

function deserializeLogEntry(line: string): LogEntry {
  return jsonParse(line) as LogEntry
}

async function* makeLogEntryReader(): AsyncGenerator<LogEntry> {
  const currentSession = getSessionId()

  // Start with entries that have yet to be flushed to disk
  for (let i = pendingEntries.length - 1; i >= 0; i--) {
    yield pendingEntries[i]!
  }

  // Read from global history file (shared across all projects)
  const historyPath = join(getClaudeConfigHomeDir(), 'history.jsonl')

  try {
    for await (const line of readLinesReverse(historyPath)) {
      try {
        const entry = deserializeLogEntry(line)
        // removeLastFromHistory slow path: entry was flushed before removal,
        // so filter here so both getHistory (Up-arrow) and makeHistoryReader
        // (ctrl+r search) skip it consistently.
        if (
          entry.sessionId === currentSession &&
          skippedTimestamps.has(entry.timestamp)
        ) {
          continue
        }
        yield entry
      } catch (error) {
        // Not a critical error - just skip malformed lines
        logForDebugging(`Failed to parse history line: ${error}`)
      }
    }
  } catch (e: unknown) {
    const code = getErrnoCode(e)
    if (code === 'ENOENT') {
      return
    }
    throw e
  }
}

export async function* makeHistoryReader(): AsyncGenerator<HistoryEntry> {
  for await (const entry of makeLogEntryReader()) {
    yield await logEntryToHistoryEntry(entry)
  }
}

export type TimestampedHistoryEntry = {
  display: string
  timestamp: number
  resolve: () => Promise<HistoryEntry>
}

/**
 * Current-project history for the ctrl+r picker: deduped by display text,
 * newest first, with timestamps. Paste contents are resolved lazily via
 * `resolve()` — the picker only reads display+timestamp for the list.
 */
export async function* getTimestampedHistory(): AsyncGenerator<TimestampedHistoryEntry> {
  const currentProject = getProjectRoot()
  const seen = new Set<string>()

  for await (const entry of makeLogEntryReader()) {
    if (!entry || typeof entry.project !== 'string') continue
    if (entry.project !== currentProject) continue
    if (seen.has(entry.display)) continue
    seen.add(entry.display)

    yield {
      display: entry.display,
      timestamp: entry.timestamp,
      resolve: () => logEntryToHistoryEntry(entry),
    }

    if (seen.size >= MAX_HISTORY_ITEMS) return
  }
}

/**
 * Get history entries for the current project, with current session's entries first.
 *
 * Entries from the current session are yielded before entries from other sessions,
 * so concurrent sessions don't interleave their up-arrow history. Within each group,
 * order is newest-first. Scans the same MAX_HISTORY_ITEMS window as before —
 * entries are reordered within that window, not beyond it.
 */
export async function* getHistory(): AsyncGenerator<HistoryEntry> {
  const currentProject = getProjectRoot()
  const currentSession = getSessionId()
  const otherSessionEntries: LogEntry[] = []
  let yielded = 0

  for await (const entry of makeLogEntryReader()) {
    // Skip malformed entries (corrupted file, old format, or invalid JSON structure)
    if (!entry || typeof entry.project !== 'string') continue
    if (entry.project !== currentProject) continue

    if (entry.sessionId === currentSession) {
      yield await logEntryToHistoryEntry(entry)
      yielded++
    } else {
      otherSessionEntries.push(entry)
    }

    // Same MAX_HISTORY_ITEMS window as before — just reordered within it.
    if (yielded + otherSessionEntries.length >= MAX_HISTORY_ITEMS) break
  }

  for (const entry of otherSessionEntries) {
    if (yielded >= MAX_HISTORY_ITEMS) return
    yield await logEntryToHistoryEntry(entry)
    yielded++
  }
}

type LogEntry = {
  display: string
  pastedContents: Record<number, StoredPastedContent>
  timestamp: number
  project: string
  sessionId?: string
}

/**
 * Resolve stored paste content to full PastedContent by fetching from paste store if needed.
 */
async function resolveStoredPastedContent(
  stored: StoredPastedContent,
): Promise<PastedContent | null> {
  // If we have inline content, use it directly
  if (stored.content) {
    return {
      id: stored.id,
      type: stored.type,
      content: stored.content,
      mediaType: stored.mediaType,
      filename: stored.filename,
    }
  }

  // If we have a hash reference, fetch from paste store
  if (stored.contentHash) {
    const content = await retrievePastedText(stored.contentHash)
    if (content) {
      return {
        id: stored.id,
        type: stored.type,
        content,
        mediaType: stored.mediaType,
        filename: stored.filename,
      }
    }
  }

  // Content not available
  return null
}

/**
 * Convert LogEntry to HistoryEntry by resolving paste store references.
 */
async function logEntryToHistoryEntry(entry: LogEntry): Promise<HistoryEntry> {
  const pastedContents: Record<number, PastedContent> = {}

  for (const [id, stored] of Object.entries(entry.pastedContents || {})) {
    const resolved = await resolveStoredPastedContent(stored)
    if (resolved) {
      pastedContents[Number(id)] = resolved
    }
  }

  return {
    display: entry.display,
    pastedContents,
  }
}

let pendingEntries: LogEntry[] = []
let isWriting = false
let currentFlushPromise: Promise<void> | null = null
let cleanupRegistered = false
let lastAddedEntry: LogEntry | null = null
// Timestamps of entries already flushed to disk that should be skipped when
// reading. Used by removeLastFromHistory when the entry has raced past the
// pending buffer. Session-scoped (module state resets on process restart).
const skippedTimestamps = new Set<number>()

// Core flush logic - writes pending entries to disk
async function immediateFlushHistory(): Promise<void> {
  if (pendingEntries.length === 0) {
    return
  }

  let release
  try {
    const historyPath = join(getClaudeConfigHomeDir(), 'history.jsonl')

    // Ensure the file exists before acquiring lock (append mode creates if missing)
    await writeFile(historyPath, '', {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'a',
    })

    release = await lock(historyPath, {
      stale: 10000,
      retries: {
        retries: 3,
        minTimeout: 50,
      },
    })

    const jsonLines = pendingEntries.map(entry => jsonStringify(entry) + '\n')
    pendingEntries = []

    await appendFile(historyPath, jsonLines.join(''), { mode: 0o600 })
  } catch (error) {
    logForDebugging(`Failed to write prompt history: ${error}`)
  } finally {
    if (release) {
      await release()
    }
  }
}

async function flushPromptHistory(retries: number): Promise<void> {
  if (isWriting || pendingEntries.length === 0) {
    return
  }

  // Stop trying to flush history until the next user prompt
  if (retries > 5) {
    return
  }

  isWriting = true

  try {
    await immediateFlushHistory()
  } finally {
    isWriting = false

    if (pendingEntries.length > 0) {
      // Avoid trying again in a hot loop
      await sleep(500)

      void flushPromptHistory(retries + 1)
    }
  }
}

async function addToPromptHistory(
  command: HistoryEntry | string,
): Promise<void> {
  const entry =
    typeof command === 'string'
      ? { display: command, pastedContents: {} }
      : command

  const storedPastedContents: Record<number, StoredPastedContent> = {}
  if (entry.pastedContents) {
    for (const [id, content] of Object.entries(entry.pastedContents)) {
      // Filter out images (they're stored separately in image-cache)
      if (content.type === 'image') {
        continue
      }

      // For small text content, store inline
      if (content.content.length <= MAX_PASTED_CONTENT_LENGTH) {
        storedPastedContents[Number(id)] = {
          id: content.id,
          type: content.type,
          content: content.content,
          mediaType: content.mediaType,
          filename: content.filename,
        }
      } else {
        // For large text content, compute hash synchronously and store reference
        // The actual disk write happens async (fire-and-forget)
        const hash = hashPastedText(content.content)
        storedPastedContents[Number(id)] = {
          id: content.id,
          type: content.type,
          contentHash: hash,
          mediaType: content.mediaType,
          filename: content.filename,
        }
        // Fire-and-forget disk write - don't block history entry creation
        void storePastedText(hash, content.content)
      }
    }
  }

  const logEntry: LogEntry = {
    ...entry,
    pastedContents: storedPastedContents,
    timestamp: Date.now(),
    project: getProjectRoot(),
    sessionId: getSessionId(),
  }

  pendingEntries.push(logEntry)
  lastAddedEntry = logEntry
  currentFlushPromise = flushPromptHistory(0)
  void currentFlushPromise
}

export function addToHistory(command: HistoryEntry | string): void {
  // Skip history when running in a tmux session spawned by Claude Code's Tungsten tool.
  // This prevents verification/test sessions from polluting the user's real command history.
  if (isEnvTruthy(process.env.CLAUDE_CODE_SKIP_PROMPT_HISTORY)) {
    return
  }

  // Register cleanup on first use
  if (!cleanupRegistered) {
    cleanupRegistered = true
    registerCleanup(async () => {
      // If there's an in-progress flush, wait for it
      if (currentFlushPromise) {
        await currentFlushPromise
      }
      // If there are still pending entries after the flush completed, do one final flush
      if (pendingEntries.length > 0) {
        await immediateFlushHistory()
      }
    })
  }

  void addToPromptHistory(command)
}

export function clearPendingHistoryEntries(): void {
  pendingEntries = []
  lastAddedEntry = null
  skippedTimestamps.clear()
}

/**
 * Undo the most recent addToHistory call. Used by auto-restore-on-interrupt:
 * when Esc rewinds the conversation before any response arrives, the submit is
 * semantically undone — the history entry should be too, otherwise Up-arrow
 * shows the restored text twice (once from the input box, once from disk).
 *
 * Fast path pops from the pending buffer. If the async flush already won the
 * race (TTFT is typically >> disk write latency), the entry's timestamp is
 * added to a skip-set consulted by getHistory. One-shot: clears the tracked
 * entry so a second call is a no-op.
 */
export function removeLastFromHistory(): void {
  if (!lastAddedEntry) return
  const entry = lastAddedEntry
  lastAddedEntry = null

  const idx = pendingEntries.lastIndexOf(entry)
  if (idx !== -1) {
    pendingEntries.splice(idx, 1)
  } else {
    skippedTimestamps.add(entry.timestamp)
  }
}
