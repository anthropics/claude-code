import type { StructuredPatchHunk } from 'diff'
import { access, readFile } from 'fs/promises'
import { dirname, join, relative, sep } from 'path'
import { getCwd } from './cwd.js'
import { getCachedRepository } from './detectRepository.js'
import { execFileNoThrow, execFileNoThrowWithCwd } from './execFileNoThrow.js'
import { isFileWithinReadSizeLimit } from './file.js'
import {
  findGitRoot,
  getDefaultBranch,
  getGitDir,
  getIsGit,
  gitExe,
} from './git.js'

export type GitDiffStats = {
  filesCount: number
  linesAdded: number
  linesRemoved: number
}

export type PerFileStats = {
  added: number
  removed: number
  isBinary: boolean
  isUntracked?: boolean
}

export type GitDiffResult = {
  stats: GitDiffStats
  perFileStats: Map<string, PerFileStats>
  hunks: Map<string, StructuredPatchHunk[]>
}

const GIT_TIMEOUT_MS = 5000
const MAX_FILES = 50
const MAX_DIFF_SIZE_BYTES = 1_000_000 // 1 MB - skip files larger than this
const MAX_LINES_PER_FILE = 400 // GitHub's auto-load limit
const MAX_FILES_FOR_DETAILS = 500 // Skip per-file details if more files than this

/**
 * Fetch git diff stats and hunks comparing working tree to HEAD.
 * Returns null if not in a git repo or if git commands fail.
 *
 * Returns null during merge/rebase/cherry-pick/revert operations since the
 * working tree contains incoming changes that weren't intentionally
 * made by the user.
 */
export async function fetchGitDiff(): Promise<GitDiffResult | null> {
  const isGit = await getIsGit()
  if (!isGit) return null

  // Skip diff calculation during transient git states since the
  // working tree contains incoming changes, not user-intentional edits
  if (await isInTransientGitState()) {
    return null
  }

  // Quick probe: use --shortstat to get totals without loading all content.
  // This is O(1) memory and lets us detect massive diffs (e.g., jj workspaces)
  // before committing to expensive operations.
  const { stdout: shortstatOut, code: shortstatCode } = await execFileNoThrow(
    gitExe(),
    ['--no-optional-locks', 'diff', 'HEAD', '--shortstat'],
    { timeout: GIT_TIMEOUT_MS, preserveOutputOnError: false },
  )

  if (shortstatCode === 0) {
    const quickStats = parseShortstat(shortstatOut)
    if (quickStats && quickStats.filesCount > MAX_FILES_FOR_DETAILS) {
      // Too many files - return accurate totals but skip per-file details
      // to avoid loading hundreds of MB into memory
      return {
        stats: quickStats,
        perFileStats: new Map(),
        hunks: new Map(),
      }
    }
  }

  // Get stats via --numstat (all uncommitted changes vs HEAD)
  const { stdout: numstatOut, code: numstatCode } = await execFileNoThrow(
    gitExe(),
    ['--no-optional-locks', 'diff', 'HEAD', '--numstat'],
    { timeout: GIT_TIMEOUT_MS, preserveOutputOnError: false },
  )

  if (numstatCode !== 0) return null

  const { stats, perFileStats } = parseGitNumstat(numstatOut)

  // Include untracked files (new files not yet staged)
  // Just filenames - no content reading for performance
  const remainingSlots = MAX_FILES - perFileStats.size
  if (remainingSlots > 0) {
    const untrackedStats = await fetchUntrackedFiles(remainingSlots)
    if (untrackedStats) {
      stats.filesCount += untrackedStats.size
      for (const [path, fileStats] of untrackedStats) {
        perFileStats.set(path, fileStats)
      }
    }
  }

  // Return stats only - hunks are fetched on-demand via fetchGitDiffHunks()
  // to avoid expensive git diff HEAD call on every poll
  return { stats, perFileStats, hunks: new Map() }
}

/**
 * Fetch git diff hunks on-demand (for DiffDialog).
 * Separated from fetchGitDiff() to avoid expensive calls during polling.
 */
export async function fetchGitDiffHunks(): Promise<
  Map<string, StructuredPatchHunk[]>
> {
  const isGit = await getIsGit()
  if (!isGit) return new Map()

  if (await isInTransientGitState()) {
    return new Map()
  }

  const { stdout: diffOut, code: diffCode } = await execFileNoThrow(
    gitExe(),
    ['--no-optional-locks', 'diff', 'HEAD'],
    { timeout: GIT_TIMEOUT_MS, preserveOutputOnError: false },
  )

  if (diffCode !== 0) {
    return new Map()
  }

  return parseGitDiff(diffOut)
}

export type NumstatResult = {
  stats: GitDiffStats
  perFileStats: Map<string, PerFileStats>
}

/**
 * Parse git diff --numstat output into stats.
 * Format: <added>\t<removed>\t<filename>
 * Binary files show '-' for counts.
 * Only stores first MAX_FILES entries in perFileStats.
 */
export function parseGitNumstat(stdout: string): NumstatResult {
  const lines = stdout.trim().split('\n').filter(Boolean)
  let added = 0
  let removed = 0
  let validFileCount = 0
  const perFileStats = new Map<string, PerFileStats>()

  for (const line of lines) {
    const parts = line.split('\t')
    // Valid numstat lines have exactly 3 tab-separated parts: added, removed, filename
    if (parts.length < 3) continue

    validFileCount++
    const addStr = parts[0]
    const remStr = parts[1]
    const filePath = parts.slice(2).join('\t') // filename may contain tabs
    const isBinary = addStr === '-' || remStr === '-'
    const fileAdded = isBinary ? 0 : parseInt(addStr ?? '0', 10) || 0
    const fileRemoved = isBinary ? 0 : parseInt(remStr ?? '0', 10) || 0

    added += fileAdded
    removed += fileRemoved

    // Only store first MAX_FILES entries
    if (perFileStats.size < MAX_FILES) {
      perFileStats.set(filePath, {
        added: fileAdded,
        removed: fileRemoved,
        isBinary,
      })
    }
  }

  return {
    stats: {
      filesCount: validFileCount,
      linesAdded: added,
      linesRemoved: removed,
    },
    perFileStats,
  }
}

/**
 * Parse unified diff output into per-file hunks.
 * Splits by "diff --git" and parses each file's hunks.
 *
 * Applies limits:
 * - MAX_FILES: stop after this many files
 * - Files >1MB: skipped entirely (not in result map)
 * - Files ≤1MB: parsed but limited to MAX_LINES_PER_FILE lines
 */
export function parseGitDiff(
  stdout: string,
): Map<string, StructuredPatchHunk[]> {
  const result = new Map<string, StructuredPatchHunk[]>()
  if (!stdout.trim()) return result

  // Split by file diffs
  const fileDiffs = stdout.split(/^diff --git /m).filter(Boolean)

  for (const fileDiff of fileDiffs) {
    // Stop after MAX_FILES
    if (result.size >= MAX_FILES) break

    // Skip files larger than 1MB
    if (fileDiff.length > MAX_DIFF_SIZE_BYTES) {
      continue
    }

    const lines = fileDiff.split('\n')

    // Extract filename from first line: "a/path/to/file b/path/to/file"
    const headerMatch = lines[0]?.match(/^a\/(.+?) b\/(.+)$/)
    if (!headerMatch) continue
    const filePath = headerMatch[2] ?? headerMatch[1] ?? ''

    // Find and parse hunks
    const fileHunks: StructuredPatchHunk[] = []
    let currentHunk: StructuredPatchHunk | null = null
    let lineCount = 0

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i] ?? ''

      // StructuredPatchHunk header: @@ -oldStart,oldLines +newStart,newLines @@
      const hunkMatch = line.match(
        /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/,
      )
      if (hunkMatch) {
        if (currentHunk) {
          fileHunks.push(currentHunk)
        }
        currentHunk = {
          oldStart: parseInt(hunkMatch[1] ?? '0', 10),
          oldLines: parseInt(hunkMatch[2] ?? '1', 10),
          newStart: parseInt(hunkMatch[3] ?? '0', 10),
          newLines: parseInt(hunkMatch[4] ?? '1', 10),
          lines: [],
        }
        continue
      }

      // Skip binary file markers and other metadata
      if (
        line.startsWith('index ') ||
        line.startsWith('---') ||
        line.startsWith('+++') ||
        line.startsWith('new file') ||
        line.startsWith('deleted file') ||
        line.startsWith('old mode') ||
        line.startsWith('new mode') ||
        line.startsWith('Binary files')
      ) {
        continue
      }

      // Add diff lines to current hunk (with line limit)
      if (
        currentHunk &&
        (line.startsWith('+') ||
          line.startsWith('-') ||
          line.startsWith(' ') ||
          line === '')
      ) {
        // Stop adding lines once we hit the limit
        if (lineCount >= MAX_LINES_PER_FILE) {
          continue
        }
        // Force a flat string copy to break V8 sliced string references.
        // When split() creates lines, V8 creates "sliced strings" that reference
        // the parent. This keeps the entire parent string (~MBs) alive as long as
        // any line is retained. Using '' + line forces a new flat string allocation,
        // unlike slice(0) which V8 may optimize to return the same reference.
        currentHunk.lines.push('' + line)
        lineCount++
      }
    }

    // Don't forget the last hunk
    if (currentHunk) {
      fileHunks.push(currentHunk)
    }

    if (fileHunks.length > 0) {
      result.set(filePath, fileHunks)
    }
  }

  return result
}

/**
 * Check if we're in a transient git state (merge, rebase, cherry-pick, or revert).
 * During these operations, we skip diff calculation since the working
 * tree contains incoming changes that weren't intentionally made.
 *
 * Uses fs.access to check for transient ref files, avoiding process spawns.
 */
async function isInTransientGitState(): Promise<boolean> {
  const gitDir = await getGitDir(getCwd())
  if (!gitDir) return false

  const transientFiles = [
    'MERGE_HEAD',
    'REBASE_HEAD',
    'CHERRY_PICK_HEAD',
    'REVERT_HEAD',
  ]

  const results = await Promise.all(
    transientFiles.map(file =>
      access(join(gitDir, file))
        .then(() => true)
        .catch(() => false),
    ),
  )
  return results.some(Boolean)
}

/**
 * Fetch untracked file names (no content reading).
 * Returns file paths only - they'll be displayed with a note to stage them.
 *
 * @param maxFiles Maximum number of untracked files to include
 */
async function fetchUntrackedFiles(
  maxFiles: number,
): Promise<Map<string, PerFileStats> | null> {
  // Get list of untracked files (excludes gitignored)
  const { stdout, code } = await execFileNoThrow(
    gitExe(),
    ['--no-optional-locks', 'ls-files', '--others', '--exclude-standard'],
    { timeout: GIT_TIMEOUT_MS, preserveOutputOnError: false },
  )

  if (code !== 0 || !stdout.trim()) return null

  const untrackedPaths = stdout.trim().split('\n').filter(Boolean)
  if (untrackedPaths.length === 0) return null

  const perFileStats = new Map<string, PerFileStats>()

  // Just record filenames, no content reading
  for (const filePath of untrackedPaths.slice(0, maxFiles)) {
    perFileStats.set(filePath, {
      added: 0,
      removed: 0,
      isBinary: false,
      isUntracked: true,
    })
  }

  return perFileStats
}

/**
 * Parse git diff --shortstat output into stats.
 * Format: " 1648 files changed, 52341 insertions(+), 8123 deletions(-)"
 *
 * This is O(1) memory regardless of diff size - git computes totals without
 * loading all content. Used as a quick probe before expensive operations.
 */
export function parseShortstat(stdout: string): GitDiffStats | null {
  // Match: "N files changed" with optional ", N insertions(+)" and ", N deletions(-)"
  const match = stdout.match(
    /(\d+)\s+files?\s+changed(?:,\s+(\d+)\s+insertions?\(\+\))?(?:,\s+(\d+)\s+deletions?\(-\))?/,
  )
  if (!match) return null
  return {
    filesCount: parseInt(match[1] ?? '0', 10),
    linesAdded: parseInt(match[2] ?? '0', 10),
    linesRemoved: parseInt(match[3] ?? '0', 10),
  }
}

const SINGLE_FILE_DIFF_TIMEOUT_MS = 3000

export type ToolUseDiff = {
  filename: string
  status: 'modified' | 'added'
  additions: number
  deletions: number
  changes: number
  patch: string
  /** GitHub "owner/repo" when available (null for non-github.com or unknown repos) */
  repository: string | null
}

/**
 * Fetch a structured diff for a single file against the merge base with the
 * default branch. This produces a PR-like diff showing all changes since
 * the branch diverged. Falls back to diffing against HEAD if the merge base
 * cannot be determined (e.g., on the default branch itself).
 * For untracked files, generates a synthetic diff showing all additions.
 * Returns null if not in a git repo or if git commands fail.
 */
export async function fetchSingleFileGitDiff(
  absoluteFilePath: string,
): Promise<ToolUseDiff | null> {
  const gitRoot = findGitRoot(dirname(absoluteFilePath))
  if (!gitRoot) return null

  const gitPath = relative(gitRoot, absoluteFilePath).split(sep).join('/')
  const repository = getCachedRepository()

  // Check if the file is tracked by git
  const { code: lsFilesCode } = await execFileNoThrowWithCwd(
    gitExe(),
    ['--no-optional-locks', 'ls-files', '--error-unmatch', gitPath],
    { cwd: gitRoot, timeout: SINGLE_FILE_DIFF_TIMEOUT_MS },
  )

  if (lsFilesCode === 0) {
    // File is tracked - diff against merge base for PR-like view
    const diffRef = await getDiffRef(gitRoot)
    const { stdout, code } = await execFileNoThrowWithCwd(
      gitExe(),
      ['--no-optional-locks', 'diff', diffRef, '--', gitPath],
      { cwd: gitRoot, timeout: SINGLE_FILE_DIFF_TIMEOUT_MS },
    )
    if (code !== 0) return null
    if (!stdout) return null
    return {
      ...parseRawDiffToToolUseDiff(gitPath, stdout, 'modified'),
      repository,
    }
  }

  // File is untracked - generate synthetic diff
  const syntheticDiff = await generateSyntheticDiff(gitPath, absoluteFilePath)
  if (!syntheticDiff) return null
  return { ...syntheticDiff, repository }
}

/**
 * Parse raw unified diff output into the structured ToolUseDiff format.
 * Extracts only the hunk content (starting from @@) as the patch,
 * and counts additions/deletions.
 */
function parseRawDiffToToolUseDiff(
  filename: string,
  rawDiff: string,
  status: 'modified' | 'added',
): Omit<ToolUseDiff, 'repository'> {
  const lines = rawDiff.split('\n')
  const patchLines: string[] = []
  let inHunks = false
  let additions = 0
  let deletions = 0

  for (const line of lines) {
    if (line.startsWith('@@')) {
      inHunks = true
    }
    if (inHunks) {
      patchLines.push(line)
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++
      }
    }
  }

  return {
    filename,
    status,
    additions,
    deletions,
    changes: additions + deletions,
    patch: patchLines.join('\n'),
  }
}

/**
 * Determine the best ref to diff against for a PR-like diff.
 * Priority:
 * 1. CLAUDE_CODE_BASE_REF env var (set externally, e.g. by CCR managed containers)
 * 2. Merge base with the default branch (best guess)
 * 3. HEAD (fallback if merge-base fails)
 */
async function getDiffRef(gitRoot: string): Promise<string> {
  const baseBranch =
    process.env.CLAUDE_CODE_BASE_REF || (await getDefaultBranch())
  const { stdout, code } = await execFileNoThrowWithCwd(
    gitExe(),
    ['--no-optional-locks', 'merge-base', 'HEAD', baseBranch],
    { cwd: gitRoot, timeout: SINGLE_FILE_DIFF_TIMEOUT_MS },
  )
  if (code === 0 && stdout.trim()) {
    return stdout.trim()
  }
  return 'HEAD'
}

async function generateSyntheticDiff(
  gitPath: string,
  absoluteFilePath: string,
): Promise<Omit<ToolUseDiff, 'repository'> | null> {
  try {
    if (!isFileWithinReadSizeLimit(absoluteFilePath, MAX_DIFF_SIZE_BYTES)) {
      return null
    }
    const content = await readFile(absoluteFilePath, 'utf-8')
    const lines = content.split('\n')
    // Remove trailing empty line from split if file ends with newline
    if (lines.length > 0 && lines.at(-1) === '') {
      lines.pop()
    }
    const lineCount = lines.length
    const addedLines = lines.map(line => `+${line}`).join('\n')
    const patch = `@@ -0,0 +1,${lineCount} @@\n${addedLines}`
    return {
      filename: gitPath,
      status: 'added',
      additions: lineCount,
      deletions: 0,
      changes: lineCount,
      patch,
    }
  } catch {
    return null
  }
}
