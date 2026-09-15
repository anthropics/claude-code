import axios from 'axios'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { coerce } from 'semver'
import { getIsNonInteractiveSession } from '../bootstrap/state.js'
import { getGlobalConfig, saveGlobalConfig } from './config.js'
import { getClaudeConfigHomeDir } from './envUtils.js'
import { toError } from './errors.js'
import { logError } from './log.js'
import { isEssentialTrafficOnly } from './privacyLevel.js'
import { gt } from './semver.js'

const MAX_RELEASE_NOTES_SHOWN = 5

/**
 * We fetch the changelog from GitHub instead of bundling it with the build.
 *
 * This is necessary because Ink's static rendering makes it difficult to
 * dynamically update/show components after initial render. By storing the
 * changelog in config, we ensure it's available on the next startup without
 * requiring a full re-render of the current UI.
 *
 * The flow is:
 * 1. User updates to a new version
 * 2. We fetch the changelog in the background and store it in config
 * 3. Next time the user starts Claude, the cached changelog is available immediately
 */
export const CHANGELOG_URL =
  'https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md'
const RAW_CHANGELOG_URL =
  'https://raw.githubusercontent.com/anthropics/claude-code/refs/heads/main/CHANGELOG.md'

/**
 * Get the path for the cached changelog file.
 * The changelog is stored at ~/.claude/cache/changelog.md
 */
function getChangelogCachePath(): string {
  return join(getClaudeConfigHomeDir(), 'cache', 'changelog.md')
}

// In-memory cache populated by async reads. Sync callers (React render, sync
// helpers) read from this cache after setup.ts awaits checkForReleaseNotes().
let changelogMemoryCache: string | null = null

/** @internal exported for tests */
export function _resetChangelogCacheForTesting(): void {
  changelogMemoryCache = null
}

/**
 * Migrate changelog from old config-based storage to file-based storage.
 * This should be called once at startup to ensure the migration happens
 * before any other config saves that might re-add the deprecated field.
 */
export async function migrateChangelogFromConfig(): Promise<void> {
  const config = getGlobalConfig()
  if (!config.cachedChangelog) {
    return
  }

  const cachePath = getChangelogCachePath()

  // If cache file doesn't exist, create it from old config
  try {
    await mkdir(dirname(cachePath), { recursive: true })
    await writeFile(cachePath, config.cachedChangelog, {
      encoding: 'utf-8',
      flag: 'wx', // Write only if file doesn't exist
    })
  } catch {
    // File already exists, which is fine - skip silently
  }

  // Remove the deprecated field from config
  saveGlobalConfig(({ cachedChangelog: _, ...rest }) => rest)
}

/**
 * Fetch the changelog from GitHub and store it in cache file
 * This runs in the background and doesn't block the UI
 */
export async function fetchAndStoreChangelog(): Promise<void> {
  // Skip in noninteractive mode
  if (getIsNonInteractiveSession()) {
    return
  }

  // Skip network requests if nonessential traffic is disabled
  if (isEssentialTrafficOnly()) {
    return
  }

  const response = await axios.get(RAW_CHANGELOG_URL)
  if (response.status === 200) {
    const changelogContent = response.data

    // Skip write if content unchanged — writing Date.now() defeats the
    // dirty-check in saveGlobalConfig since the timestamp always differs.
    if (changelogContent === changelogMemoryCache) {
      return
    }

    const cachePath = getChangelogCachePath()

    // Ensure cache directory exists
    await mkdir(dirname(cachePath), { recursive: true })

    // Write changelog to cache file
    await writeFile(cachePath, changelogContent, { encoding: 'utf-8' })
    changelogMemoryCache = changelogContent

    // Update timestamp in config
    const changelogLastFetched = Date.now()
    saveGlobalConfig(current => ({
      ...current,
      changelogLastFetched,
    }))
  }
}

/**
 * Get the stored changelog from cache file if available.
 * Populates the in-memory cache for subsequent sync reads.
 * @returns The cached changelog content or empty string if not available
 */
export async function getStoredChangelog(): Promise<string> {
  if (changelogMemoryCache !== null) {
    return changelogMemoryCache
  }
  const cachePath = getChangelogCachePath()
  try {
    const content = await readFile(cachePath, 'utf-8')
    changelogMemoryCache = content
    return content
  } catch {
    changelogMemoryCache = ''
    return ''
  }
}

/**
 * Synchronous accessor for the changelog, reading only from the in-memory cache.
 * Returns empty string if the async getStoredChangelog() hasn't been called yet.
 * Intended for React render paths where async is not possible; setup.ts ensures
 * the cache is populated before first render via `await checkForReleaseNotes()`.
 */
export function getStoredChangelogFromMemory(): string {
  return changelogMemoryCache ?? ''
}

/**
 * Parses a changelog string in markdown format into a structured format
 * @param content - The changelog content string
 * @returns Record mapping version numbers to arrays of release notes
 */
export function parseChangelog(content: string): Record<string, string[]> {
  try {
    if (!content) return {}

    // Parse the content
    const releaseNotes: Record<string, string[]> = {}

    // Split by heading lines (## X.X.X)
    const sections = content.split(/^## /gm).slice(1) // Skip the first section which is the header

    for (const section of sections) {
      const lines = section.trim().split('\n')
      if (lines.length === 0) continue

      // Extract version from the first line
      // Handle both "1.2.3" and "1.2.3 - YYYY-MM-DD" formats
      const versionLine = lines[0]
      if (!versionLine) continue

      // First part before any dash is the version
      const version = versionLine.split(' - ')[0]?.trim() || ''
      if (!version) continue

      // Extract bullet points
      const notes = lines
        .slice(1)
        .filter(line => line.trim().startsWith('- '))
        .map(line => line.trim().substring(2).trim())
        .filter(Boolean)

      if (notes.length > 0) {
        releaseNotes[version] = notes
      }
    }

    return releaseNotes
  } catch (error) {
    logError(toError(error))
    return {}
  }
}

/**
 * Gets release notes to show based on the previously seen version.
 * Shows up to MAX_RELEASE_NOTES_SHOWN items total, prioritizing the most recent versions.
 *
 * @param currentVersion - The current app version
 * @param previousVersion - The last version where release notes were seen (or null if first time)
 * @param readChangelog - Function to read the changelog (defaults to readChangelogFile)
 * @returns Array of release notes to display
 */
export function getRecentReleaseNotes(
  currentVersion: string,
  previousVersion: string | null | undefined,
  changelogContent: string = getStoredChangelogFromMemory(),
): string[] {
  try {
    const releaseNotes = parseChangelog(changelogContent)

    // Strip SHA from both versions to compare only the base versions
    const baseCurrentVersion = coerce(currentVersion)
    const basePreviousVersion = previousVersion ? coerce(previousVersion) : null

    if (
      !basePreviousVersion ||
      (baseCurrentVersion &&
        gt(baseCurrentVersion.version, basePreviousVersion.version))
    ) {
      // Get all versions that are newer than the last seen version
      return Object.entries(releaseNotes)
        .filter(
          ([version]) =>
            !basePreviousVersion || gt(version, basePreviousVersion.version),
        )
        .sort(([versionA], [versionB]) => (gt(versionA, versionB) ? -1 : 1)) // Sort newest first
        .flatMap(([_, notes]) => notes)
        .filter(Boolean)
        .slice(0, MAX_RELEASE_NOTES_SHOWN)
    }
  } catch (error) {
    logError(toError(error))
    return []
  }
  return []
}

/**
 * Gets all release notes as an array of [version, notes] arrays.
 * Versions are sorted with oldest first.
 *
 * @param readChangelog - Function to read the changelog (defaults to readChangelogFile)
 * @returns Array of [version, notes[]] arrays
 */
export function getAllReleaseNotes(
  changelogContent: string = getStoredChangelogFromMemory(),
): Array<[string, string[]]> {
  try {
    const releaseNotes = parseChangelog(changelogContent)

    // Sort versions with oldest first
    const sortedVersions = Object.keys(releaseNotes).sort((a, b) =>
      gt(a, b) ? 1 : -1,
    )

    // Return array of [version, notes] arrays
    return sortedVersions
      .map(version => {
        const versionNotes = releaseNotes[version]
        if (!versionNotes || versionNotes.length === 0) return null

        const notes = versionNotes.filter(Boolean)
        if (notes.length === 0) return null

        return [version, notes] as [string, string[]]
      })
      .filter((item): item is [string, string[]] => item !== null)
  } catch (error) {
    logError(toError(error))
    return []
  }
}

/**
 * Checks if there are release notes to show based on the last seen version.
 * Can be used by multiple components to determine whether to display release notes.
 * Also triggers a fetch of the latest changelog if the version has changed.
 *
 * @param lastSeenVersion The last version of release notes the user has seen
 * @param currentVersion The current application version, defaults to MACRO.VERSION
 * @returns An object with hasReleaseNotes and the releaseNotes content
 */
export async function checkForReleaseNotes(
  lastSeenVersion: string | null | undefined,
  currentVersion: string = MACRO.VERSION,
): Promise<{ hasReleaseNotes: boolean; releaseNotes: string[] }> {
  // For Ant builds, use VERSION_CHANGELOG bundled at build time
  if (process.env.USER_TYPE === 'ant') {
    const changelog = MACRO.VERSION_CHANGELOG
    if (changelog) {
      const commits = changelog.trim().split('\n').filter(Boolean)
      return {
        hasReleaseNotes: commits.length > 0,
        releaseNotes: commits,
      }
    }
    return {
      hasReleaseNotes: false,
      releaseNotes: [],
    }
  }

  // Ensure the in-memory cache is populated for subsequent sync reads
  const cachedChangelog = await getStoredChangelog()

  // If the version has changed or we don't have a cached changelog, fetch a new one
  // This happens in the background and doesn't block the UI
  if (lastSeenVersion !== currentVersion || !cachedChangelog) {
    fetchAndStoreChangelog().catch(error => logError(toError(error)))
  }

  const releaseNotes = getRecentReleaseNotes(
    currentVersion,
    lastSeenVersion,
    cachedChangelog,
  )
  const hasReleaseNotes = releaseNotes.length > 0

  return {
    hasReleaseNotes,
    releaseNotes,
  }
}

/**
 * Synchronous variant of checkForReleaseNotes for React render paths.
 * Reads only from the in-memory cache populated by the async version.
 * setup.ts awaits checkForReleaseNotes() before first render, so this
 * returns accurate results in component render bodies.
 */
export function checkForReleaseNotesSync(
  lastSeenVersion: string | null | undefined,
  currentVersion: string = MACRO.VERSION,
): { hasReleaseNotes: boolean; releaseNotes: string[] } {
  // For Ant builds, use VERSION_CHANGELOG bundled at build time
  if (process.env.USER_TYPE === 'ant') {
    const changelog = MACRO.VERSION_CHANGELOG
    if (changelog) {
      const commits = changelog.trim().split('\n').filter(Boolean)
      return {
        hasReleaseNotes: commits.length > 0,
        releaseNotes: commits,
      }
    }
    return {
      hasReleaseNotes: false,
      releaseNotes: [],
    }
  }

  const releaseNotes = getRecentReleaseNotes(currentVersion, lastSeenVersion)
  return {
    hasReleaseNotes: releaseNotes.length > 0,
    releaseNotes,
  }
}
