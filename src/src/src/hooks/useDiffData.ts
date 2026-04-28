import type { StructuredPatchHunk } from 'diff'
import { useEffect, useMemo, useState } from 'react'
import {
  fetchGitDiff,
  fetchGitDiffHunks,
  type GitDiffResult,
  type GitDiffStats,
} from '../utils/gitDiff.js'

const MAX_LINES_PER_FILE = 400

export type DiffFile = {
  path: string
  linesAdded: number
  linesRemoved: number
  isBinary: boolean
  isLargeFile: boolean
  isTruncated: boolean
  isNewFile?: boolean
  isUntracked?: boolean
}

export type DiffData = {
  stats: GitDiffStats | null
  files: DiffFile[]
  hunks: Map<string, StructuredPatchHunk[]>
  loading: boolean
}

/**
 * Hook to fetch current git diff data on demand.
 * Fetches both stats and hunks when component mounts.
 */
export function useDiffData(): DiffData {
  const [diffResult, setDiffResult] = useState<GitDiffResult | null>(null)
  const [hunks, setHunks] = useState<Map<string, StructuredPatchHunk[]>>(
    new Map(),
  )
  const [loading, setLoading] = useState(true)

  // Fetch diff data on mount
  useEffect(() => {
    let cancelled = false

    async function loadDiffData() {
      try {
        // Fetch both stats and hunks
        const [statsResult, hunksResult] = await Promise.all([
          fetchGitDiff(),
          fetchGitDiffHunks(),
        ])

        if (!cancelled) {
          setDiffResult(statsResult)
          setHunks(hunksResult)
          setLoading(false)
        }
      } catch (_error) {
        if (!cancelled) {
          setDiffResult(null)
          setHunks(new Map())
          setLoading(false)
        }
      }
    }

    void loadDiffData()

    return () => {
      cancelled = true
    }
  }, [])

  return useMemo(() => {
    if (!diffResult) {
      return { stats: null, files: [], hunks: new Map(), loading }
    }

    const { stats, perFileStats } = diffResult
    const files: DiffFile[] = []

    // Iterate over perFileStats to get all files including large/skipped ones
    for (const [path, fileStats] of perFileStats) {
      const fileHunks = hunks.get(path)
      const isUntracked = fileStats.isUntracked ?? false

      // Detect large file (in perFileStats but not in hunks, and not binary/untracked)
      const isLargeFile = !fileStats.isBinary && !isUntracked && !fileHunks

      // Detect truncated file (total > limit means we truncated)
      const totalLines = fileStats.added + fileStats.removed
      const isTruncated =
        !isLargeFile && !fileStats.isBinary && totalLines > MAX_LINES_PER_FILE

      files.push({
        path,
        linesAdded: fileStats.added,
        linesRemoved: fileStats.removed,
        isBinary: fileStats.isBinary,
        isLargeFile,
        isTruncated,
        isUntracked,
      })
    }

    files.sort((a, b) => a.path.localeCompare(b.path))

    return { stats, files, hunks, loading: false }
  }, [diffResult, hunks, loading])
}
