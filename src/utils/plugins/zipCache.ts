/**
 * Plugin Zip Cache Module
 *
 * Manages plugins as ZIP archives in a mounted directory (e.g., Filestore).
 * When CLAUDE_CODE_PLUGIN_USE_ZIP_CACHE is enabled and CLAUDE_CODE_PLUGIN_CACHE_DIR
 * is set, plugins are stored as ZIPs in that directory and extracted to a
 * session-local temp directory at startup.
 *
 * Limitations:
 * - Only headless mode is supported
 * - All settings sources are used (same as normal plugin flow)
 * - Only github, git, and url marketplace sources are supported
 * - Only strict:true marketplace entries are supported
 * - Auto-update is non-blocking (background, does not affect current session)
 *
 * Directory structure of the zip cache:
 * /mnt/plugins-cache/
 *   ├── known_marketplaces.json
 *   ├── installed_plugins.json
 *   ├── marketplaces/
 *   │   ├── official-marketplace.json
 *   │   └── company-marketplace.json
 *   └── plugins/
 *       ├── official-marketplace/
 *       │   └── plugin-a/
 *       │       └── 1.0.0.zip
 *       └── company-marketplace/
 *           └── plugin-b/
 *               └── 2.1.3.zip
 */

import { randomBytes } from 'crypto'
import {
  chmod,
  lstat,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'fs/promises'
import { tmpdir } from 'os'
import { basename, dirname, join } from 'path'
import { logForDebugging } from '../debug.js'
import { parseZipModes, unzipFile } from '../dxt/zip.js'
import { isEnvTruthy } from '../envUtils.js'
import { getFsImplementation } from '../fsOperations.js'
import { expandTilde } from '../permissions/pathValidation.js'
import type { MarketplaceSource } from './schemas.js'

/**
 * Check if the plugin zip cache mode is enabled.
 */
export function isPluginZipCacheEnabled(): boolean {
  return isEnvTruthy(process.env.CLAUDE_CODE_PLUGIN_USE_ZIP_CACHE)
}

/**
 * Get the path to the zip cache directory.
 * Requires CLAUDE_CODE_PLUGIN_CACHE_DIR to be set.
 * Returns undefined if zip cache is not enabled.
 */
export function getPluginZipCachePath(): string | undefined {
  if (!isPluginZipCacheEnabled()) {
    return undefined
  }
  const dir = process.env.CLAUDE_CODE_PLUGIN_CACHE_DIR
  return dir ? expandTilde(dir) : undefined
}

/**
 * Get the path to known_marketplaces.json in the zip cache.
 */
export function getZipCacheKnownMarketplacesPath(): string {
  const cachePath = getPluginZipCachePath()
  if (!cachePath) {
    throw new Error('Plugin zip cache is not enabled')
  }
  return join(cachePath, 'known_marketplaces.json')
}

/**
 * Get the path to installed_plugins.json in the zip cache.
 */
export function getZipCacheInstalledPluginsPath(): string {
  const cachePath = getPluginZipCachePath()
  if (!cachePath) {
    throw new Error('Plugin zip cache is not enabled')
  }
  return join(cachePath, 'installed_plugins.json')
}

/**
 * Get the marketplaces directory within the zip cache.
 */
export function getZipCacheMarketplacesDir(): string {
  const cachePath = getPluginZipCachePath()
  if (!cachePath) {
    throw new Error('Plugin zip cache is not enabled')
  }
  return join(cachePath, 'marketplaces')
}

/**
 * Get the plugins directory within the zip cache.
 */
export function getZipCachePluginsDir(): string {
  const cachePath = getPluginZipCachePath()
  if (!cachePath) {
    throw new Error('Plugin zip cache is not enabled')
  }
  return join(cachePath, 'plugins')
}

// Session plugin cache: a temp directory on local disk (NOT in the mounted zip cache)
// that holds extracted plugins for the duration of the session.
let sessionPluginCachePath: string | null = null
let sessionPluginCachePromise: Promise<string> | null = null

/**
 * Get or create the session plugin cache directory.
 * This is a temp directory on local disk where plugins are extracted for the session.
 */
export async function getSessionPluginCachePath(): Promise<string> {
  if (sessionPluginCachePath) {
    return sessionPluginCachePath
  }
  if (!sessionPluginCachePromise) {
    sessionPluginCachePromise = (async () => {
      const suffix = randomBytes(8).toString('hex')
      const dir = join(tmpdir(), `claude-plugin-session-${suffix}`)
      await getFsImplementation().mkdir(dir)
      sessionPluginCachePath = dir
      logForDebugging(`Created session plugin cache at ${dir}`)
      return dir
    })()
  }
  return sessionPluginCachePromise
}

/**
 * Clean up the session plugin cache directory.
 * Should be called when the session ends.
 */
export async function cleanupSessionPluginCache(): Promise<void> {
  if (!sessionPluginCachePath) {
    return
  }
  try {
    await rm(sessionPluginCachePath, { recursive: true, force: true })
    logForDebugging(
      `Cleaned up session plugin cache at ${sessionPluginCachePath}`,
    )
  } catch (error) {
    logForDebugging(`Failed to clean up session plugin cache: ${error}`)
  } finally {
    sessionPluginCachePath = null
    sessionPluginCachePromise = null
  }
}

/**
 * Reset the session plugin cache path (for testing).
 */
export function resetSessionPluginCache(): void {
  sessionPluginCachePath = null
  sessionPluginCachePromise = null
}

/**
 * Write data to a file in the zip cache atomically.
 * Writes to a temp file in the same directory, then renames.
 */
export async function atomicWriteToZipCache(
  targetPath: string,
  data: string | Uint8Array,
): Promise<void> {
  const dir = dirname(targetPath)
  await getFsImplementation().mkdir(dir)

  const tmpName = `.${basename(targetPath)}.tmp.${randomBytes(4).toString('hex')}`
  const tmpPath = join(dir, tmpName)

  try {
    if (typeof data === 'string') {
      await writeFile(tmpPath, data, { encoding: 'utf-8' })
    } else {
      await writeFile(tmpPath, data)
    }
    await rename(tmpPath, targetPath)
  } catch (error) {
    // Clean up tmp file on failure
    try {
      await rm(tmpPath, { force: true })
    } catch {
      // ignore cleanup errors
    }
    throw error
  }
}

// fflate's ZippableFile tuple form: [data, opts]. Using the tuple lets us
// store {os, attrs} so parseZipModes can recover exec bits on extraction.
type ZipEntry = [Uint8Array, { os: number; attrs: number }]

/**
 * Create a ZIP archive from a directory.
 * Resolves symlinks to actual file contents (replaces symlinks with real data).
 * Stores Unix mode bits in external_attr so extractZipToDirectory can restore
 * +x — otherwise the round-trip (git clone → zip → extract) loses exec bits.
 *
 * @param sourceDir - Directory to zip
 * @returns ZIP file as Uint8Array
 */
export async function createZipFromDirectory(
  sourceDir: string,
): Promise<Uint8Array> {
  const files: Record<string, ZipEntry> = {}
  const visited = new Set<string>()
  await collectFilesForZip(sourceDir, '', files, visited)

  const { zipSync } = await import('fflate')
  const zipData = zipSync(files, { level: 6 })
  logForDebugging(
    `Created ZIP from ${sourceDir}: ${Object.keys(files).length} files, ${zipData.length} bytes`,
  )
  return zipData
}

/**
 * Recursively collect files from a directory for zipping.
 * Uses lstat to detect symlinks and tracks visited inodes for cycle detection.
 */
async function collectFilesForZip(
  baseDir: string,
  relativePath: string,
  files: Record<string, ZipEntry>,
  visited: Set<string>,
): Promise<void> {
  const currentDir = relativePath ? join(baseDir, relativePath) : baseDir
  let entries: string[]
  try {
    entries = await readdir(currentDir)
  } catch {
    return
  }

  // Track visited directories by dev+ino to detect symlink cycles.
  // bigint: true is required — on Windows NTFS, the file index packs a 16-bit
  // sequence number into the high bits. Once that sequence exceeds ~32 (very
  // common on a busy CI runner that churns through temp files), the value
  // exceeds Number.MAX_SAFE_INTEGER and two adjacent directories round to the
  // same JS number, causing subdirs to be silently skipped as "cycles". This
  // broke the round-trip test on Windows CI when sharding shuffled which tests
  // ran first and pushed MFT sequence numbers over the precision cliff.
  // See also: markdownConfigLoader.ts getFileIdentity, anthropics/claude-code#13893
  try {
    const dirStat = await stat(currentDir, { bigint: true })
    // ReFS (Dev Drive), NFS, some FUSE mounts report dev=0 and ino=0 for
    // everything. Fail open: skip cycle detection rather than skip the
    // directory. We already skip symlinked directories unconditionally below,
    // so the only cycle left here is a bind mount, which we accept.
    if (dirStat.dev !== 0n || dirStat.ino !== 0n) {
      const key = `${dirStat.dev}:${dirStat.ino}`
      if (visited.has(key)) {
        logForDebugging(`Skipping symlink cycle at ${currentDir}`)
        return
      }
      visited.add(key)
    }
  } catch {
    return
  }

  for (const entry of entries) {
    // Skip hidden files that are git-related
    if (entry === '.git') {
      continue
    }

    const fullPath = join(currentDir, entry)
    const relPath = relativePath ? `${relativePath}/${entry}` : entry

    let fileStat
    try {
      fileStat = await lstat(fullPath)
    } catch {
      continue
    }

    // Skip symlinked directories (follow symlinked files)
    if (fileStat.isSymbolicLink()) {
      try {
        const targetStat = await stat(fullPath)
        if (targetStat.isDirectory()) {
          continue
        }
        // Symlinked file — read its contents below
        fileStat = targetStat
      } catch {
        continue // broken symlink
      }
    }

    if (fileStat.isDirectory()) {
      await collectFilesForZip(baseDir, relPath, files, visited)
    } else if (fileStat.isFile()) {
      try {
        const content = await readFile(fullPath)
        // os=3 (Unix) + st_mode in high 16 bits of external_attr — this is
        // what parseZipModes reads back on extraction. fileStat is already
        // in hand from the lstat/stat above, so no extra syscall.
        files[relPath] = [
          new Uint8Array(content),
          { os: 3, attrs: (fileStat.mode & 0xffff) << 16 },
        ]
      } catch (error) {
        logForDebugging(`Failed to read file for zip: ${relPath}: ${error}`)
      }
    }
  }
}

/**
 * Extract a ZIP file to a target directory.
 *
 * @param zipPath - Path to the ZIP file
 * @param targetDir - Directory to extract into
 */
export async function extractZipToDirectory(
  zipPath: string,
  targetDir: string,
): Promise<void> {
  const zipBuf = await getFsImplementation().readFileBytes(zipPath)
  const files = await unzipFile(zipBuf)
  // fflate doesn't surface external_attr — parse the central directory so
  // exec bits survive extraction (hooks/scripts need +x to run via `sh -c`).
  const modes = parseZipModes(zipBuf)

  await getFsImplementation().mkdir(targetDir)

  for (const [relPath, data] of Object.entries(files)) {
    // Skip directory entries (trailing slash)
    if (relPath.endsWith('/')) {
      await getFsImplementation().mkdir(join(targetDir, relPath))
      continue
    }

    const fullPath = join(targetDir, relPath)
    await getFsImplementation().mkdir(dirname(fullPath))
    await writeFile(fullPath, data)
    const mode = modes[relPath]
    if (mode && mode & 0o111) {
      // Swallow EPERM/ENOTSUP (NFS root_squash, some FUSE mounts) — losing +x
      // is the pre-PR behavior and better than aborting mid-extraction.
      await chmod(fullPath, mode & 0o777).catch(() => {})
    }
  }

  logForDebugging(
    `Extracted ZIP to ${targetDir}: ${Object.keys(files).length} entries`,
  )
}

/**
 * Convert a plugin directory to a ZIP in-place: zip → atomic write → delete dir.
 * Both call sites (cacheAndRegisterPlugin, copyPluginToVersionedCache) need the
 * same sequence; getting it wrong (non-atomic write, forgetting rm) corrupts cache.
 */
export async function convertDirectoryToZipInPlace(
  dirPath: string,
  zipPath: string,
): Promise<void> {
  const zipData = await createZipFromDirectory(dirPath)
  await atomicWriteToZipCache(zipPath, zipData)
  await rm(dirPath, { recursive: true, force: true })
}

/**
 * Get the relative path for a marketplace JSON file within the zip cache.
 * Format: marketplaces/{marketplace-name}.json
 */
export function getMarketplaceJsonRelativePath(
  marketplaceName: string,
): string {
  const sanitized = marketplaceName.replace(/[^a-zA-Z0-9\-_]/g, '-')
  return join('marketplaces', `${sanitized}.json`)
}

/**
 * Check if a marketplace source type is supported by zip cache mode.
 *
 * Supported sources write to `join(cacheDir, name)` — syncMarketplacesToZipCache
 * reads marketplace.json from that installLocation, source-type-agnostic.
 * - github/git/url: clone to temp, rename into cacheDir
 * - settings: write synthetic marketplace.json directly to cacheDir (no fetch)
 *
 * Excluded: file/directory (installLocation is the user's path OUTSIDE cacheDir —
 * nonsensical in ephemeral containers), npm (node_modules bloat on Filestore mount).
 */
export function isMarketplaceSourceSupportedByZipCache(
  source: MarketplaceSource,
): boolean {
  return ['github', 'git', 'url', 'settings'].includes(source.source)
}
