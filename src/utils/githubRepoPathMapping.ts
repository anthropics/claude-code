import { realpath } from 'fs/promises'
import { getOriginalCwd } from '../bootstrap/state.js'
import { getGlobalConfig, saveGlobalConfig } from './config.js'
import { logForDebugging } from './debug.js'
import {
  detectCurrentRepository,
  parseGitHubRepository,
} from './detectRepository.js'
import { pathExists } from './file.js'
import { getRemoteUrlForDir } from './git/gitFilesystem.js'
import { findGitRoot } from './git.js'

/**
 * Updates the GitHub repository path mapping in global config.
 * Called at startup (fire-and-forget) to track known local paths for repos.
 * This is non-blocking and errors are logged silently.
 *
 * Stores the git root (not cwd) so the mapping always points to the
 * repository root regardless of which subdirectory the user launched from.
 * If the path is already tracked, it is promoted to the front of the list
 * so the most recently used clone appears first.
 */
export async function updateGithubRepoPathMapping(): Promise<void> {
  try {
    const repo = await detectCurrentRepository()
    if (!repo) {
      logForDebugging(
        'Not in a GitHub repository, skipping path mapping update',
      )
      return
    }

    // Use the git root as the canonical path for this repo clone.
    // This ensures we always store the repo root, not an arbitrary subdirectory.
    const cwd = getOriginalCwd()
    const gitRoot = findGitRoot(cwd)
    const basePath = gitRoot ?? cwd

    // Resolve symlinks for canonical storage
    let currentPath: string
    try {
      currentPath = (await realpath(basePath)).normalize('NFC')
    } catch {
      currentPath = basePath
    }

    // Normalize repo key to lowercase for case-insensitive matching
    const repoKey = repo.toLowerCase()

    const config = getGlobalConfig()
    const existingPaths = config.githubRepoPaths?.[repoKey] ?? []

    if (existingPaths[0] === currentPath) {
      // Already at the front — nothing to do
      logForDebugging(`Path ${currentPath} already tracked for repo ${repoKey}`)
      return
    }

    // Remove if present elsewhere (to promote to front), then prepend
    const withoutCurrent = existingPaths.filter(p => p !== currentPath)
    const updatedPaths = [currentPath, ...withoutCurrent]

    saveGlobalConfig(current => ({
      ...current,
      githubRepoPaths: {
        ...current.githubRepoPaths,
        [repoKey]: updatedPaths,
      },
    }))

    logForDebugging(`Added ${currentPath} to tracked paths for repo ${repoKey}`)
  } catch (error) {
    logForDebugging(`Error updating repo path mapping: ${error}`)
    // Silently fail - this is non-blocking startup work
  }
}

/**
 * Gets known local paths for a given GitHub repository.
 * @param repo The repository in "owner/repo" format
 * @returns Array of known absolute paths, or empty array if none
 */
export function getKnownPathsForRepo(repo: string): string[] {
  const config = getGlobalConfig()
  const repoKey = repo.toLowerCase()
  return config.githubRepoPaths?.[repoKey] ?? []
}

/**
 * Filters paths to only those that exist on the filesystem.
 * @param paths Array of absolute paths to check
 * @returns Array of paths that exist
 */
export async function filterExistingPaths(paths: string[]): Promise<string[]> {
  const results = await Promise.all(paths.map(pathExists))
  return paths.filter((_, i) => results[i])
}

/**
 * Validates that a path contains the expected GitHub repository.
 * @param path Absolute path to check
 * @param expectedRepo Expected repository in "owner/repo" format
 * @returns true if the path contains the expected repo, false otherwise
 */
export async function validateRepoAtPath(
  path: string,
  expectedRepo: string,
): Promise<boolean> {
  try {
    const remoteUrl = await getRemoteUrlForDir(path)
    if (!remoteUrl) {
      return false
    }

    const actualRepo = parseGitHubRepository(remoteUrl)
    if (!actualRepo) {
      return false
    }

    // Case-insensitive comparison
    return actualRepo.toLowerCase() === expectedRepo.toLowerCase()
  } catch {
    return false
  }
}

/**
 * Removes a path from the tracked paths for a given repository.
 * Used when a path is found to be invalid during selection.
 * @param repo The repository in "owner/repo" format
 * @param pathToRemove The path to remove from tracking
 */
export function removePathFromRepo(repo: string, pathToRemove: string): void {
  const config = getGlobalConfig()
  const repoKey = repo.toLowerCase()
  const existingPaths = config.githubRepoPaths?.[repoKey] ?? []

  const updatedPaths = existingPaths.filter(path => path !== pathToRemove)

  if (updatedPaths.length === existingPaths.length) {
    // Path wasn't in the list, nothing to do
    return
  }

  const updatedMapping = { ...config.githubRepoPaths }

  if (updatedPaths.length === 0) {
    // Remove the repo key entirely if no paths remain
    delete updatedMapping[repoKey]
  } else {
    updatedMapping[repoKey] = updatedPaths
  }

  saveGlobalConfig(current => ({
    ...current,
    githubRepoPaths: updatedMapping,
  }))

  logForDebugging(
    `Removed ${pathToRemove} from tracked paths for repo ${repoKey}`,
  )
}
