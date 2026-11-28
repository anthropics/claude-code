import { feature } from 'bun:bundle'
import { statSync } from 'fs'
import { lstat, readdir, readFile, realpath, stat } from 'fs/promises'
import memoize from 'lodash-es/memoize.js'
import { homedir } from 'os'
import { dirname, join, resolve, sep } from 'path'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from 'src/services/analytics/index.js'
import { getProjectRoot } from '../bootstrap/state.js'
import { logForDebugging } from './debug.js'
import { getClaudeConfigHomeDir, isEnvTruthy } from './envUtils.js'
import { isFsInaccessible } from './errors.js'
import { normalizePathForComparison } from './file.js'
import type { FrontmatterData } from './frontmatterParser.js'
import { parseFrontmatter } from './frontmatterParser.js'
import { findCanonicalGitRoot, findGitRoot } from './git.js'
import { parseToolListFromCLI } from './permissions/permissionSetup.js'
import { ripGrep } from './ripgrep.js'
import {
  isSettingSourceEnabled,
  type SettingSource,
} from './settings/constants.js'
import { getManagedFilePath } from './settings/managedPath.js'
import { isRestrictedToPluginOnly } from './settings/pluginOnlyPolicy.js'

// Claude configuration directory names
export const CLAUDE_CONFIG_DIRECTORIES = [
  'commands',
  'agents',
  'output-styles',
  'skills',
  'workflows',
  ...(feature('TEMPLATES') ? (['templates'] as const) : []),
] as const

export type ClaudeConfigDirectory = (typeof CLAUDE_CONFIG_DIRECTORIES)[number]

export type MarkdownFile = {
  filePath: string
  baseDir: string
  frontmatter: FrontmatterData
  content: string
  source: SettingSource
}

/**
 * Extracts a description from markdown content
 * Uses the first non-empty line as the description, or falls back to a default
 */
export function extractDescriptionFromMarkdown(
  content: string,
  defaultDescription: string = 'Custom item',
): string {
  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed) {
      // If it's a header, strip the header prefix
      const headerMatch = trimmed.match(/^#+\s+(.+)$/)
      const text = headerMatch?.[1] ?? trimmed

      // Return the text, limited to reasonable length
      return text.length > 100 ? text.substring(0, 97) + '...' : text
    }
  }
  return defaultDescription
}

/**
 * Parses tools from frontmatter, supporting both string and array formats
 * Always returns a string array for consistency
 * @param toolsValue The value from frontmatter
 * @returns Parsed tool list as string[]
 */
function parseToolListString(toolsValue: unknown): string[] | null {
  // Return null for missing/null - let caller decide the default
  if (toolsValue === undefined || toolsValue === null) {
    return null
  }

  // Empty string or other falsy values mean no tools
  if (!toolsValue) {
    return []
  }

  let toolsArray: string[] = []
  if (typeof toolsValue === 'string') {
    toolsArray = [toolsValue]
  } else if (Array.isArray(toolsValue)) {
    toolsArray = toolsValue.filter(
      (item): item is string => typeof item === 'string',
    )
  }

  if (toolsArray.length === 0) {
    return []
  }

  const parsedTools = parseToolListFromCLI(toolsArray)
  if (parsedTools.includes('*')) {
    return ['*']
  }
  return parsedTools
}

/**
 * Parse tools from agent frontmatter
 * Missing field = undefined (all tools)
 * Empty field = [] (no tools)
 */
export function parseAgentToolsFromFrontmatter(
  toolsValue: unknown,
): string[] | undefined {
  const parsed = parseToolListString(toolsValue)
  if (parsed === null) {
    // For agents: undefined = all tools (undefined), null = no tools ([])
    return toolsValue === undefined ? undefined : []
  }
  // If parsed contains '*', return undefined (all tools)
  if (parsed.includes('*')) {
    return undefined
  }
  return parsed
}

/**
 * Parse allowed-tools from slash command frontmatter
 * Missing or empty field = no tools ([])
 */
export function parseSlashCommandToolsFromFrontmatter(
  toolsValue: unknown,
): string[] {
  const parsed = parseToolListString(toolsValue)
  if (parsed === null) {
    return []
  }
  return parsed
}

/**
 * Gets a unique identifier for a file based on its device ID and inode.
 * This allows detection of duplicate files accessed through different paths
 * (e.g., via symlinks). Returns null if the file doesn't exist or can't be stat'd.
 *
 * Note: On Windows, dev and ino may not be reliable for all file systems.
 * The code handles this gracefully by returning null on error (fail open),
 * meaning deduplication may not work on some Windows configurations.
 *
 * Uses bigint: true to handle filesystems with large inodes (e.g., ExFAT)
 * that exceed JavaScript's Number precision (53 bits). Without bigint, different
 * large inodes can round to the same Number, causing false duplicate detection.
 * See: https://github.com/anthropics/claude-code/issues/13893
 *
 * @param filePath - Path to the file
 * @returns A string identifier "device:inode" or null if file can't be identified
 */
async function getFileIdentity(filePath: string): Promise<string | null> {
  try {
    const stats = await lstat(filePath, { bigint: true })
    // Some filesystems (NFS, FUSE, network mounts) report dev=0 and ino=0
    // for all files, which would cause every file to look like a duplicate.
    // Return null to skip deduplication for these unreliable identities.
    if (stats.dev === 0n && stats.ino === 0n) {
      return null
    }
    return `${stats.dev}:${stats.ino}`
  } catch {
    return null
  }
}

/**
 * Compute the stop boundary for getProjectDirsUpToHome's upward walk.
 *
 * Normally the walk stops at the nearest `.git` above `cwd`. But if the Bash
 * tool has cd'd into a nested git repo inside the session's project (submodule,
 * vendored dep with its own `.git`), that nested root isn't the right boundary —
 * stopping there makes the parent project's `.claude/` unreachable (#31905).
 *
 * The boundary is widened to the session's git root only when BOTH:
 *   - the nearest `.git` from cwd belongs to a *different* canonical repo
 *     (submodule/vendored clone — not a worktree, which resolves back to main)
 *   - that nearest `.git` sits *inside* the session's project tree
 *
 * Worktrees (under `.claude/worktrees/`) stay on the old behavior: their `.git`
 * file is the stop, and loadMarkdownFilesForSubdir's fallback adds the main-repo
 * copy only when the worktree lacks one.
 */
function resolveStopBoundary(cwd: string): string | null {
  const cwdGitRoot = findGitRoot(cwd)
  const sessionGitRoot = findGitRoot(getProjectRoot())
  if (!cwdGitRoot || !sessionGitRoot) {
    return cwdGitRoot
  }
  // findCanonicalGitRoot resolves worktree `.git` files to the main repo.
  // Submodules (no commondir) and standalone clones fall through unchanged.
  const cwdCanonical = findCanonicalGitRoot(cwd)
  if (
    cwdCanonical &&
    normalizePathForComparison(cwdCanonical) ===
      normalizePathForComparison(sessionGitRoot)
  ) {
    // Same canonical repo (main, or a worktree of main). Stop at nearest .git.
    return cwdGitRoot
  }
  // Different canonical repo. Is it nested *inside* the session's project?
  const nCwdGitRoot = normalizePathForComparison(cwdGitRoot)
  const nSessionRoot = normalizePathForComparison(sessionGitRoot)
  if (
    nCwdGitRoot !== nSessionRoot &&
    nCwdGitRoot.startsWith(nSessionRoot + sep)
  ) {
    // Nested repo inside the project — skip past it, stop at the project's root.
    return sessionGitRoot
  }
  // Sibling repo or elsewhere. Stop at nearest .git (old behavior).
  return cwdGitRoot
}

/**
 * Traverses from the current directory up to the git root (or home directory if not in a git repo),
 * collecting all .claude directories along the way.
 *
 * Stopping at git root prevents commands/skills from parent directories outside the repository
 * from leaking into projects. For example, if ~/projects/.claude/commands/ exists, it won't
 * appear in ~/projects/my-repo/ if my-repo is a git repository.
 *
 * @param subdir Subdirectory (eg. "commands", "agents")
 * @param cwd Current working directory to start from
 * @returns Array of directory paths containing .claude/subdir, from most specific (cwd) to least specific
 */
export function getProjectDirsUpToHome(
  subdir: ClaudeConfigDirectory,
  cwd: string,
): string[] {
  const home = resolve(homedir()).normalize('NFC')
  const gitRoot = resolveStopBoundary(cwd)
  let current = resolve(cwd)
  const dirs: string[] = []

  // Traverse from current directory up to git root (or home if not in a git repo)
  while (true) {
    // Stop if we've reached the home directory (don't check it, as it's loaded separately as userDir)
    // Use normalized comparison to handle Windows drive letter casing (C:\ vs c:\)
    if (
      normalizePathForComparison(current) === normalizePathForComparison(home)
    ) {
      break
    }

    const claudeSubdir = join(current, '.claude', subdir)
    // Filter to existing dirs. This is a perf filter (avoids spawning
    // ripgrep on non-existent dirs downstream) and the worktree fallback
    // in loadMarkdownFilesForSubdir relies on it. statSync + explicit error
    // handling instead of existsSync — re-throws unexpected errors rather
    // than silently swallowing them. Downstream loadMarkdownFiles handles
    // the TOCTOU window (dir disappearing before read) gracefully.
    try {
      statSync(claudeSubdir)
      dirs.push(claudeSubdir)
    } catch (e: unknown) {
      if (!isFsInaccessible(e)) throw e
    }

    // Stop after processing the git root directory - this prevents commands from parent
    // directories outside the repository from appearing in the project
    if (
      gitRoot &&
      normalizePathForComparison(current) ===
        normalizePathForComparison(gitRoot)
    ) {
      break
    }

    // Move to parent directory
    const parent = dirname(current)

    // Safety check: if parent is the same as current, we've reached the root
    if (parent === current) {
      break
    }

    current = parent
  }

  return dirs
}

/**
 * Loads markdown files from managed, user, and project directories
 * @param subdir Subdirectory (eg. "agents" or "commands")
 * @param cwd Current working directory for project directory traversal
 * @returns Array of parsed markdown files with metadata
 */
export const loadMarkdownFilesForSubdir = memoize(
  async function (
    subdir: ClaudeConfigDirectory,
    cwd: string,
  ): Promise<MarkdownFile[]> {
    const searchStartTime = Date.now()
    const userDir = join(getClaudeConfigHomeDir(), subdir)
    const managedDir = join(getManagedFilePath(), '.claude', subdir)
    const projectDirs = getProjectDirsUpToHome(subdir, cwd)

    // For git worktrees where the worktree does NOT have .claude/<subdir> checked
    // out (e.g. sparse-checkout), fall back to the main repository's copy.
    // getProjectDirsUpToHome stops at the worktree root (where the .git file is),
    // so it never sees the main repo on its own.
    //
    // Only add the main repo's copy when the worktree root's .claude/<subdir>
    // is absent. A standard `git worktree add` checks out the full tree, so the
    // worktree already has identical .claude/<subdir> content — loading the main
    // repo's copy too would duplicate every command/agent/skill
    // (anthropics/claude-code#29599, #28182, #26992).
    //
    // projectDirs already reflects existence (getProjectDirsUpToHome checked
    // each dir), so we compare against that instead of stat'ing again.
    const gitRoot = findGitRoot(cwd)
    const canonicalRoot = findCanonicalGitRoot(cwd)
    if (gitRoot && canonicalRoot && canonicalRoot !== gitRoot) {
      const worktreeSubdir = normalizePathForComparison(
        join(gitRoot, '.claude', subdir),
      )
      const worktreeHasSubdir = projectDirs.some(
        dir => normalizePathForComparison(dir) === worktreeSubdir,
      )
      if (!worktreeHasSubdir) {
        const mainClaudeSubdir = join(canonicalRoot, '.claude', subdir)
        if (!projectDirs.includes(mainClaudeSubdir)) {
          projectDirs.push(mainClaudeSubdir)
        }
      }
    }

    const [managedFiles, userFiles, projectFilesNested] = await Promise.all([
      // Always load managed (policy settings)
      loadMarkdownFiles(managedDir).then(_ =>
        _.map(file => ({
          ...file,
          baseDir: managedDir,
          source: 'policySettings' as const,
        })),
      ),
      // Conditionally load user files
      isSettingSourceEnabled('userSettings') &&
      !(subdir === 'agents' && isRestrictedToPluginOnly('agents'))
        ? loadMarkdownFiles(userDir).then(_ =>
            _.map(file => ({
              ...file,
              baseDir: userDir,
              source: 'userSettings' as const,
            })),
          )
        : Promise.resolve([]),
      // Conditionally load project files from all directories up to home
      isSettingSourceEnabled('projectSettings') &&
      !(subdir === 'agents' && isRestrictedToPluginOnly('agents'))
        ? Promise.all(
            projectDirs.map(projectDir =>
              loadMarkdownFiles(projectDir).then(_ =>
                _.map(file => ({
                  ...file,
                  baseDir: projectDir,
                  source: 'projectSettings' as const,
                })),
              ),
            ),
          )
        : Promise.resolve([]),
    ])

    // Flatten nested project files array
    const projectFiles = projectFilesNested.flat()

    // Combine all files with priority: managed > user > project
    const allFiles = [...managedFiles, ...userFiles, ...projectFiles]

    // Deduplicate files that resolve to the same physical file (same inode).
    // This prevents the same file from appearing multiple times when ~/.claude is
    // symlinked to a directory within the project hierarchy, causing the same
    // physical file to be discovered through different paths.
    const fileIdentities = await Promise.all(
      allFiles.map(file => getFileIdentity(file.filePath)),
    )

    const seenFileIds = new Map<string, SettingSource>()
    const deduplicatedFiles: MarkdownFile[] = []

    for (const [i, file] of allFiles.entries()) {
      const fileId = fileIdentities[i] ?? null
      if (fileId === null) {
        // If we can't identify the file, include it (fail open)
        deduplicatedFiles.push(file)
        continue
      }
      const existingSource = seenFileIds.get(fileId)
      if (existingSource !== undefined) {
        logForDebugging(
          `Skipping duplicate file '${file.filePath}' from ${file.source} (same inode already loaded from ${existingSource})`,
        )
        continue
      }
      seenFileIds.set(fileId, file.source)
      deduplicatedFiles.push(file)
    }

    const duplicatesRemoved = allFiles.length - deduplicatedFiles.length
    if (duplicatesRemoved > 0) {
      logForDebugging(
        `Deduplicated ${duplicatesRemoved} files in ${subdir} (same inode via symlinks or hard links)`,
      )
    }

    logEvent(`tengu_dir_search`, {
      durationMs: Date.now() - searchStartTime,
      managedFilesFound: managedFiles.length,
      userFilesFound: userFiles.length,
      projectFilesFound: projectFiles.length,
      projectDirsSearched: projectDirs.length,
      subdir:
        subdir as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })

    return deduplicatedFiles
  },
  // Custom resolver creates cache key from both subdir and cwd parameters
  (subdir: ClaudeConfigDirectory, cwd: string) => `${subdir}:${cwd}`,
)

/**
 * Native implementation to find markdown files using Node.js fs APIs
 *
 * This implementation exists alongside ripgrep for the following reasons:
 * 1. Ripgrep has poor startup performance in native builds (noticeable on app startup)
 * 2. Provides a fallback when ripgrep is unavailable
 * 3. Can be explicitly enabled via CLAUDE_CODE_USE_NATIVE_FILE_SEARCH env var
 *
 * Symlink handling:
 * - Follows symlinks (equivalent to ripgrep's --follow flag)
 * - Uses device+inode tracking to detect cycles (same as ripgrep's same_file library)
 * - Falls back to realpath on systems without inode support
 *
 * Does not respect .gitignore (matches ripgrep with --no-ignore flag)
 *
 * @param dir Directory to search
 * @param signal AbortSignal for timeout
 * @returns Array of file paths
 */
async function findMarkdownFilesNative(
  dir: string,
  signal: AbortSignal,
): Promise<string[]> {
  const files: string[] = []
  const visitedDirs = new Set<string>()

  async function walk(currentDir: string): Promise<void> {
    if (signal.aborted) {
      return
    }

    // Cycle detection: track visited directories by device+inode
    // Uses bigint: true to handle filesystems with large inodes (e.g., ExFAT)
    // that exceed JavaScript's Number precision (53 bits).
    // See: https://github.com/anthropics/claude-code/issues/13893
    try {
      const stats = await stat(currentDir, { bigint: true })
      if (stats.isDirectory()) {
        const dirKey =
          stats.dev !== undefined && stats.ino !== undefined
            ? `${stats.dev}:${stats.ino}` // Unix/Linux: device + inode
            : await realpath(currentDir) // Windows: canonical path

        if (visitedDirs.has(dirKey)) {
          logForDebugging(
            `Skipping already visited directory (circular symlink): ${currentDir}`,
          )
          return
        }
        visitedDirs.add(dirKey)
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logForDebugging(`Failed to stat directory ${currentDir}: ${errorMessage}`)
      return
    }

    try {
      const entries = await readdir(currentDir, { withFileTypes: true })

      for (const entry of entries) {
        if (signal.aborted) {
          break
        }

        const fullPath = join(currentDir, entry.name)

        try {
          // Handle symlinks: isFile() and isDirectory() return false for symlinks
          if (entry.isSymbolicLink()) {
            try {
              const stats = await stat(fullPath) // stat() follows symlinks
              if (stats.isDirectory()) {
                await walk(fullPath)
              } else if (stats.isFile() && entry.name.endsWith('.md')) {
                files.push(fullPath)
              }
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error)
              logForDebugging(
                `Failed to follow symlink ${fullPath}: ${errorMessage}`,
              )
            }
          } else if (entry.isDirectory()) {
            await walk(fullPath)
          } else if (entry.isFile() && entry.name.endsWith('.md')) {
            files.push(fullPath)
          }
        } catch (error) {
          // Skip files/directories we can't access
          const errorMessage =
            error instanceof Error ? error.message : String(error)
          logForDebugging(`Failed to access ${fullPath}: ${errorMessage}`)
        }
      }
    } catch (error) {
      // If readdir fails (e.g., permission denied), log and continue
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logForDebugging(`Failed to read directory ${currentDir}: ${errorMessage}`)
    }
  }

  await walk(dir)
  return files
}

/**
 * Generic function to load markdown files from specified directories
 * @param dir Directory (eg. "~/.claude/commands")
 * @returns Array of parsed markdown files with metadata
 */
async function loadMarkdownFiles(dir: string): Promise<
  {
    filePath: string
    frontmatter: FrontmatterData
    content: string
  }[]
> {
  // File search strategy:
  // - Default: ripgrep (faster, battle-tested)
  // - Fallback: native Node.js (when CLAUDE_CODE_USE_NATIVE_FILE_SEARCH is set)
  //
  // Why both? Ripgrep has poor startup performance in native builds.
  const useNative = isEnvTruthy(process.env.CLAUDE_CODE_USE_NATIVE_FILE_SEARCH)
  const signal = AbortSignal.timeout(3000)
  let files: string[]
  try {
    files = useNative
      ? await findMarkdownFilesNative(dir, signal)
      : await ripGrep(
          ['--files', '--hidden', '--follow', '--no-ignore', '--glob', '*.md'],
          dir,
          signal,
        )
  } catch (e: unknown) {
    // Handle missing/inaccessible dir directly instead of pre-checking
    // existence (TOCTOU). findMarkdownFilesNative already catches internally;
    // ripGrep rejects on inaccessible target paths.
    if (isFsInaccessible(e)) return []
    throw e
  }

  const results = await Promise.all(
    files.map(async filePath => {
      try {
        const rawContent = await readFile(filePath, { encoding: 'utf-8' })
        const { frontmatter, content } = parseFrontmatter(rawContent, filePath)

        return {
          filePath,
          frontmatter,
          content,
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        logForDebugging(
          `Failed to read/parse markdown file:  ${filePath}: ${errorMessage}`,
        )
        return null
      }
    }),
  )

  return results.filter(_ => _ !== null)
}
