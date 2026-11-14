/**
 * Standalone implementation of listSessions for the Agent SDK.
 *
 * Dependencies are kept minimal and portable — no bootstrap/state.ts,
 * no analytics, no bun:bundle, no module-scope mutable state. This module
 * can be imported safely from the SDK entrypoint without triggering CLI
 * initialization or pulling in expensive dependency chains.
 */

import type { Dirent } from 'fs'
import { readdir, stat } from 'fs/promises'
import { basename, join } from 'path'
import { getWorktreePathsPortable } from './getWorktreePathsPortable.js'
import type { LiteSessionFile } from './sessionStoragePortable.js'
import {
  canonicalizePath,
  extractFirstPromptFromHead,
  extractJsonStringField,
  extractLastJsonStringField,
  findProjectDir,
  getProjectsDir,
  MAX_SANITIZED_LENGTH,
  readSessionLite,
  sanitizePath,
  validateUuid,
} from './sessionStoragePortable.js'

/**
 * Session metadata returned by listSessions.
 * Contains only data extractable from stat + head/tail reads — no full
 * JSONL parsing required.
 */
export type SessionInfo = {
  sessionId: string
  summary: string
  lastModified: number
  fileSize?: number
  customTitle?: string
  firstPrompt?: string
  gitBranch?: string
  cwd?: string
  tag?: string
  /** Epoch ms — from first entry's ISO timestamp. Undefined if unparseable. */
  createdAt?: number
}

export type ListSessionsOptions = {
  /**
   * Directory to list sessions for. When provided, returns sessions for
   * this project directory (and optionally its git worktrees). When omitted,
   * returns sessions across all projects.
   */
  dir?: string
  /** Maximum number of sessions to return. */
  limit?: number
  /**
   * Number of sessions to skip from the start of the sorted result set.
   * Use with `limit` for pagination. Defaults to 0.
   */
  offset?: number
  /**
   * When `dir` is provided and the directory is inside a git repository,
   * include sessions from all git worktree paths. Defaults to `true`.
   */
  includeWorktrees?: boolean
}

// ---------------------------------------------------------------------------
// Field extraction — shared by listSessionsImpl and getSessionInfoImpl
// ---------------------------------------------------------------------------

/**
 * Parses SessionInfo fields from a lite session read (head/tail/stat).
 * Returns null for sidechain sessions or metadata-only sessions with no
 * extractable summary.
 *
 * Exported for reuse by getSessionInfoImpl.
 */
export function parseSessionInfoFromLite(
  sessionId: string,
  lite: LiteSessionFile,
  projectPath?: string,
): SessionInfo | null {
  const { head, tail, mtime, size } = lite

  // Check first line for sidechain sessions
  const firstNewline = head.indexOf('\n')
  const firstLine = firstNewline >= 0 ? head.slice(0, firstNewline) : head
  if (
    firstLine.includes('"isSidechain":true') ||
    firstLine.includes('"isSidechain": true')
  ) {
    return null
  }
  // User title (customTitle) wins over AI title (aiTitle); distinct
  // field names mean extractLastJsonStringField naturally disambiguates.
  const customTitle =
    extractLastJsonStringField(tail, 'customTitle') ||
    extractLastJsonStringField(head, 'customTitle') ||
    extractLastJsonStringField(tail, 'aiTitle') ||
    extractLastJsonStringField(head, 'aiTitle') ||
    undefined
  const firstPrompt = extractFirstPromptFromHead(head) || undefined
  // First entry's ISO timestamp → epoch ms. More reliable than
  // stat().birthtime which is unsupported on some filesystems.
  const firstTimestamp = extractJsonStringField(head, 'timestamp')
  let createdAt: number | undefined
  if (firstTimestamp) {
    const parsed = Date.parse(firstTimestamp)
    if (!Number.isNaN(parsed)) createdAt = parsed
  }
  // last-prompt tail entry (captured by extractFirstPrompt at write
  // time, filtered) shows what the user was most recently doing.
  // Head scan is fallback for sessions without a last-prompt entry.
  const summary =
    customTitle ||
    extractLastJsonStringField(tail, 'lastPrompt') ||
    extractLastJsonStringField(tail, 'summary') ||
    firstPrompt

  // Skip metadata-only sessions (no title, no summary, no prompt)
  if (!summary) return null
  const gitBranch =
    extractLastJsonStringField(tail, 'gitBranch') ||
    extractJsonStringField(head, 'gitBranch') ||
    undefined
  const sessionCwd =
    extractJsonStringField(head, 'cwd') || projectPath || undefined
  // Type-scope tag extraction to the {"type":"tag"} JSONL line to avoid
  // collision with tool_use inputs containing a `tag` parameter (git tag,
  // Docker tags, cloud resource tags). Mirrors sessionStorage.ts:608.
  const tagLine = tail.split('\n').findLast(l => l.startsWith('{"type":"tag"'))
  const tag = tagLine
    ? extractLastJsonStringField(tagLine, 'tag') || undefined
    : undefined

  return {
    sessionId,
    summary,
    lastModified: mtime,
    fileSize: size,
    customTitle,
    firstPrompt,
    gitBranch,
    cwd: sessionCwd,
    tag,
    createdAt,
  }
}

// ---------------------------------------------------------------------------
// Candidate discovery — stat-only pass. Cheap: 1 syscall per file, no
// data reads. Lets us sort/filter before doing expensive head/tail reads.
// ---------------------------------------------------------------------------

type Candidate = {
  sessionId: string
  filePath: string
  mtime: number
  /** Project path for cwd fallback when file lacks a cwd field. */
  projectPath?: string
}

/**
 * Lists candidate session files in a directory via readdir, optionally
 * stat'ing each for mtime. When `doStat` is false, mtime is set to 0
 * (caller must sort/dedup after reading file contents instead).
 */
export async function listCandidates(
  projectDir: string,
  doStat: boolean,
  projectPath?: string,
): Promise<Candidate[]> {
  let names: string[]
  try {
    names = await readdir(projectDir)
  } catch {
    return []
  }

  const results = await Promise.all(
    names.map(async (name): Promise<Candidate | null> => {
      if (!name.endsWith('.jsonl')) return null
      const sessionId = validateUuid(name.slice(0, -6))
      if (!sessionId) return null
      const filePath = join(projectDir, name)
      if (!doStat) return { sessionId, filePath, mtime: 0, projectPath }
      try {
        const s = await stat(filePath)
        return { sessionId, filePath, mtime: s.mtime.getTime(), projectPath }
      } catch {
        return null
      }
    }),
  )

  return results.filter((c): c is Candidate => c !== null)
}

/**
 * Reads a candidate's file contents and extracts full SessionInfo.
 * Returns null if the session should be filtered out (sidechain, no summary).
 */
async function readCandidate(c: Candidate): Promise<SessionInfo | null> {
  const lite = await readSessionLite(c.filePath)
  if (!lite) return null

  const info = parseSessionInfoFromLite(c.sessionId, lite, c.projectPath)
  if (!info) return null

  // Prefer stat-pass mtime for sort-key consistency; fall back to
  // lite.mtime when doStat=false (c.mtime is 0 placeholder).
  if (c.mtime) info.lastModified = c.mtime

  return info
}

// ---------------------------------------------------------------------------
// Sort + limit — batch-read candidates in sorted order until `limit`
// survivors are collected (some candidates filter out on full read).
// ---------------------------------------------------------------------------

/** Batch size for concurrent reads when walking the sorted candidate list. */
const READ_BATCH_SIZE = 32

/**
 * Sort comparator: lastModified desc, then sessionId desc for stable
 * ordering across mtime ties.
 */
function compareDesc(a: Candidate, b: Candidate): number {
  if (b.mtime !== a.mtime) return b.mtime - a.mtime
  return b.sessionId < a.sessionId ? -1 : b.sessionId > a.sessionId ? 1 : 0
}

async function applySortAndLimit(
  candidates: Candidate[],
  limit: number | undefined,
  offset: number,
): Promise<SessionInfo[]> {
  candidates.sort(compareDesc)

  const sessions: SessionInfo[] = []
  // limit: 0 means "no limit" (matches getSessionMessages semantics)
  const want = limit && limit > 0 ? limit : Infinity
  let skipped = 0
  // Dedup post-filter: since candidates are sorted mtime-desc, the first
  // non-null read per sessionId is naturally the newest valid copy.
  // Pre-filter dedup would drop a session entirely if its newest-mtime
  // copy is unreadable/empty, diverging from the no-stat readAllAndSort path.
  const seen = new Set<string>()

  for (let i = 0; i < candidates.length && sessions.length < want; ) {
    const batchEnd = Math.min(i + READ_BATCH_SIZE, candidates.length)
    const batch = candidates.slice(i, batchEnd)
    const results = await Promise.all(batch.map(readCandidate))
    for (let j = 0; j < results.length && sessions.length < want; j++) {
      i++
      const r = results[j]
      if (!r) continue
      if (seen.has(r.sessionId)) continue
      seen.add(r.sessionId)
      if (skipped < offset) {
        skipped++
        continue
      }
      sessions.push(r)
    }
  }

  return sessions
}

/**
 * Read-all path for when no limit/offset is set. Skips the stat pass
 * entirely — reads every candidate, then sorts/dedups on real mtimes
 * from readSessionLite. Matches pre-refactor I/O cost (no extra stats).
 */
async function readAllAndSort(candidates: Candidate[]): Promise<SessionInfo[]> {
  const all = await Promise.all(candidates.map(readCandidate))
  const byId = new Map<string, SessionInfo>()
  for (const s of all) {
    if (!s) continue
    const existing = byId.get(s.sessionId)
    if (!existing || s.lastModified > existing.lastModified) {
      byId.set(s.sessionId, s)
    }
  }
  const sessions = [...byId.values()]
  sessions.sort((a, b) =>
    b.lastModified !== a.lastModified
      ? b.lastModified - a.lastModified
      : b.sessionId < a.sessionId
        ? -1
        : b.sessionId > a.sessionId
          ? 1
          : 0,
  )
  return sessions
}

// ---------------------------------------------------------------------------
// Project directory enumeration (single-project vs all-projects)
// ---------------------------------------------------------------------------

/**
 * Gathers candidate session files for a specific project directory
 * (and optionally its git worktrees).
 */
async function gatherProjectCandidates(
  dir: string,
  includeWorktrees: boolean,
  doStat: boolean,
): Promise<Candidate[]> {
  const canonicalDir = await canonicalizePath(dir)

  let worktreePaths: string[]
  if (includeWorktrees) {
    try {
      worktreePaths = await getWorktreePathsPortable(canonicalDir)
    } catch {
      worktreePaths = []
    }
  } else {
    worktreePaths = []
  }

  // No worktrees (or git not available / scanning disabled) — just scan the single project dir
  if (worktreePaths.length <= 1) {
    const projectDir = await findProjectDir(canonicalDir)
    if (!projectDir) return []
    return listCandidates(projectDir, doStat, canonicalDir)
  }

  // Worktree-aware scanning: find all project dirs matching any worktree
  const projectsDir = getProjectsDir()
  const caseInsensitive = process.platform === 'win32'

  // Sort worktree paths by sanitized prefix length (longest first) so
  // more specific matches take priority over shorter ones
  const indexed = worktreePaths.map(wt => {
    const sanitized = sanitizePath(wt)
    return {
      path: wt,
      prefix: caseInsensitive ? sanitized.toLowerCase() : sanitized,
    }
  })
  indexed.sort((a, b) => b.prefix.length - a.prefix.length)

  let allDirents: Dirent[]
  try {
    allDirents = await readdir(projectsDir, { withFileTypes: true })
  } catch {
    // Fall back to single project dir
    const projectDir = await findProjectDir(canonicalDir)
    if (!projectDir) return []
    return listCandidates(projectDir, doStat, canonicalDir)
  }

  const all: Candidate[] = []
  const seenDirs = new Set<string>()

  // Always include the user's actual directory (handles subdirectories
  // like /repo/packages/my-app that won't match worktree root prefixes)
  const canonicalProjectDir = await findProjectDir(canonicalDir)
  if (canonicalProjectDir) {
    const dirBase = basename(canonicalProjectDir)
    seenDirs.add(caseInsensitive ? dirBase.toLowerCase() : dirBase)
    all.push(
      ...(await listCandidates(canonicalProjectDir, doStat, canonicalDir)),
    )
  }

  for (const dirent of allDirents) {
    if (!dirent.isDirectory()) continue
    const dirName = caseInsensitive ? dirent.name.toLowerCase() : dirent.name
    if (seenDirs.has(dirName)) continue

    for (const { path: wtPath, prefix } of indexed) {
      // Only use startsWith for truncated paths (>MAX_SANITIZED_LENGTH) where
      // a hash suffix follows. For short paths, require exact match to avoid
      // /root/project matching /root/project-foo.
      const isMatch =
        dirName === prefix ||
        (prefix.length >= MAX_SANITIZED_LENGTH &&
          dirName.startsWith(prefix + '-'))
      if (isMatch) {
        seenDirs.add(dirName)
        all.push(
          ...(await listCandidates(
            join(projectsDir, dirent.name),
            doStat,
            wtPath,
          )),
        )
        break
      }
    }
  }

  return all
}

/**
 * Gathers candidate session files across all project directories.
 */
async function gatherAllCandidates(doStat: boolean): Promise<Candidate[]> {
  const projectsDir = getProjectsDir()

  let dirents: Dirent[]
  try {
    dirents = await readdir(projectsDir, { withFileTypes: true })
  } catch {
    return []
  }

  const perProject = await Promise.all(
    dirents
      .filter(d => d.isDirectory())
      .map(d => listCandidates(join(projectsDir, d.name), doStat)),
  )

  return perProject.flat()
}

/**
 * Lists sessions with metadata extracted from stat + head/tail reads.
 *
 * When `dir` is provided, returns sessions for that project directory
 * and its git worktrees. When omitted, returns sessions across all
 * projects.
 *
 * Pagination via `limit`/`offset` operates on the filtered, sorted result
 * set. When either is set, a cheap stat-only pass sorts candidates before
 * expensive head/tail reads — so `limit: 20` on a directory with 1000
 * sessions does ~1000 stats + ~20 content reads, not 1000 content reads.
 * When neither is set, stat is skipped (read-all-then-sort, same I/O cost
 * as the original implementation).
 */
export async function listSessionsImpl(
  options?: ListSessionsOptions,
): Promise<SessionInfo[]> {
  const { dir, limit, offset, includeWorktrees } = options ?? {}
  const off = offset ?? 0
  // Only stat when we need to sort before reading (won't read all anyway).
  // limit: 0 means "no limit" (see applySortAndLimit), so treat it as unset.
  const doStat = (limit !== undefined && limit > 0) || off > 0

  const candidates = dir
    ? await gatherProjectCandidates(dir, includeWorktrees ?? true, doStat)
    : await gatherAllCandidates(doStat)

  if (!doStat) return readAllAndSort(candidates)
  return applySortAndLimit(candidates, limit, off)
}
