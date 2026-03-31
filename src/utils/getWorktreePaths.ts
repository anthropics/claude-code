import { sep } from 'path'
import { logEvent } from '../services/analytics/index.js'
import { execFileNoThrowWithCwd } from './execFileNoThrow.js'
import { gitExe } from './git.js'

/**
 * Returns the paths of all worktrees for the current git repository.
 * If git is not available, not in a git repo, or only has one worktree,
 * returns an empty array.
 *
 * This version includes analytics tracking and uses the CLI's gitExe()
 * resolver. For a portable version without CLI deps, use
 * getWorktreePathsPortable().
 *
 * @param cwd Directory to run the command from
 * @returns Array of absolute worktree paths
 */
export async function getWorktreePaths(cwd: string): Promise<string[]> {
  const startTime = Date.now()

  const { stdout, code } = await execFileNoThrowWithCwd(
    gitExe(),
    ['worktree', 'list', '--porcelain'],
    {
      cwd,
      preserveOutputOnError: false,
    },
  )

  const durationMs = Date.now() - startTime

  if (code !== 0) {
    logEvent('tengu_worktree_detection', {
      duration_ms: durationMs,
      worktree_count: 0,
      success: false,
    })
    return []
  }

  // Parse porcelain output - lines starting with "worktree " contain paths
  // Example:
  // worktree /Users/foo/repo
  // HEAD abc123
  // branch refs/heads/main
  //
  // worktree /Users/foo/repo-wt1
  // HEAD def456
  // branch refs/heads/feature
  const worktreePaths = stdout
    .split('\n')
    .filter(line => line.startsWith('worktree '))
    .map(line => line.slice('worktree '.length).normalize('NFC'))

  logEvent('tengu_worktree_detection', {
    duration_ms: durationMs,
    worktree_count: worktreePaths.length,
    success: true,
  })

  // Sort worktrees: current worktree first, then alphabetically
  const currentWorktree = worktreePaths.find(
    path => cwd === path || cwd.startsWith(path + sep),
  )
  const otherWorktrees = worktreePaths
    .filter(path => path !== currentWorktree)
    .sort((a, b) => a.localeCompare(b))

  return currentWorktree ? [currentWorktree, ...otherWorktrees] : otherWorktrees
}
