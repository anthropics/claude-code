/**
 * Native Installer Implementation
 *
 * This module implements the file-based native installer system described in
 * docs/native-installer.md. It provides:
 * - Directory structure management with symlinks
 * - Version installation and activation
 * - Multi-process safety with locking
 * - Simple fallback mechanism using modification time
 * - Support for both JS and native builds
 */

import { constants as fsConstants, type Stats } from 'fs'
import {
  access,
  chmod,
  copyFile,
  lstat,
  mkdir,
  readdir,
  readlink,
  realpath,
  rename,
  rm,
  rmdir,
  stat,
  symlink,
  unlink,
  writeFile,
} from 'fs/promises'
import { homedir } from 'os'
import { basename, delimiter, dirname, join, resolve } from 'path'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from 'src/services/analytics/index.js'
import { getMaxVersion, shouldSkipVersion } from '../autoUpdater.js'
import { registerCleanup } from '../cleanupRegistry.js'
import { getGlobalConfig, saveGlobalConfig } from '../config.js'
import { logForDebugging } from '../debug.js'
import { getCurrentInstallationType } from '../doctorDiagnostic.js'
import { env } from '../env.js'
import { envDynamic } from '../envDynamic.js'
import { isEnvTruthy } from '../envUtils.js'
import { errorMessage, getErrnoCode, isENOENT, toError } from '../errors.js'
import { execFileNoThrowWithCwd } from '../execFileNoThrow.js'
import { getShellType } from '../localInstaller.js'
import * as lockfile from '../lockfile.js'
import { logError } from '../log.js'
import { gt, gte } from '../semver.js'
import {
  filterClaudeAliases,
  getShellConfigPaths,
  readFileLines,
  writeFileLines,
} from '../shellConfig.js'
import { sleep } from '../sleep.js'
import {
  getUserBinDir,
  getXDGCacheHome,
  getXDGDataHome,
  getXDGStateHome,
} from '../xdg.js'
import { downloadVersion, getLatestVersion } from './download.js'
import {
  acquireProcessLifetimeLock,
  cleanupStaleLocks,
  isLockActive,
  isPidBasedLockingEnabled,
  readLockContent,
  withLock,
} from './pidLock.js'

export const VERSION_RETENTION_COUNT = 2

// 7 days in milliseconds - used for mtime-based lock stale timeout.
// This is long enough to survive laptop sleep durations while still
// allowing cleanup of abandoned locks from crashed processes within a reasonable time.
const LOCK_STALE_MS = 7 * 24 * 60 * 60 * 1000

export type SetupMessage = {
  message: string
  userActionRequired: boolean
  type: 'path' | 'alias' | 'info' | 'error'
}

export function getPlatform(): string {
  // Use env.platform which already handles platform detection and defaults to 'linux'
  const os = env.platform

  const arch =
    process.arch === 'x64' ? 'x64' : process.arch === 'arm64' ? 'arm64' : null

  if (!arch) {
    const error = new Error(`Unsupported architecture: ${process.arch}`)
    logForDebugging(
      `Native installer does not support architecture: ${process.arch}`,
      { level: 'error' },
    )
    throw error
  }

  // Check for musl on Linux and adjust platform accordingly
  if (os === 'linux' && envDynamic.isMuslEnvironment()) {
    return `linux-${arch}-musl`
  }

  return `${os}-${arch}`
}

export function getBinaryName(platform: string): string {
  return platform.startsWith('win32') ? 'claude.exe' : 'claude'
}

function getBaseDirectories() {
  const platform = getPlatform()
  const executableName = getBinaryName(platform)

  return {
    // Data directories (permanent storage)
    versions: join(getXDGDataHome(), 'claude', 'versions'),

    // Cache directories (can be deleted)
    staging: join(getXDGCacheHome(), 'claude', 'staging'),

    // State directories
    locks: join(getXDGStateHome(), 'claude', 'locks'),

    // User bin
    executable: join(getUserBinDir(), executableName),
  }
}

async function isPossibleClaudeBinary(filePath: string): Promise<boolean> {
  try {
    const stats = await stat(filePath)
    // before download, the version lock file (located at the same filePath) will be size 0
    // also, we allow small sizes because we want to treat small wrapper scripts as valid
    if (!stats.isFile() || stats.size === 0) {
      return false
    }

    // Check if file is executable. Note: On Windows, this relies on file extensions
    // (.exe, .bat, .cmd) and ACL permissions rather than Unix permission bits,
    // so it may not work perfectly for all executable files on Windows.
    await access(filePath, fsConstants.X_OK)
    return true
  } catch {
    return false
  }
}

async function getVersionPaths(version: string) {
  const dirs = getBaseDirectories()

  // Create directories, but not the executable path (which is a file)
  const dirsToCreate = [dirs.versions, dirs.staging, dirs.locks]
  await Promise.all(dirsToCreate.map(dir => mkdir(dir, { recursive: true })))

  // Ensure parent directory of executable exists
  const executableParentDir = dirname(dirs.executable)
  await mkdir(executableParentDir, { recursive: true })

  const installPath = join(dirs.versions, version)

  // Create an empty file if it doesn't exist
  try {
    await stat(installPath)
  } catch {
    await writeFile(installPath, '', { encoding: 'utf8' })
  }

  return {
    stagingPath: join(dirs.staging, version),
    installPath,
  }
}

// Execute a callback while holding a lock on a version file
// Returns false if the file is already locked, true if callback executed
async function tryWithVersionLock(
  versionFilePath: string,
  callback: () => void | Promise<void>,
  retries = 0,
): Promise<boolean> {
  const dirs = getBaseDirectories()

  const lockfilePath = getLockFilePathFromVersionPath(dirs, versionFilePath)

  // Ensure the locks directory exists
  await mkdir(dirs.locks, { recursive: true })

  if (isPidBasedLockingEnabled()) {
    // Use PID-based locking with optional retries
    let attempts = 0
    const maxAttempts = retries + 1
    const minTimeout = retries > 0 ? 1000 : 100
    const maxTimeout = retries > 0 ? 5000 : 500

    while (attempts < maxAttempts) {
      const success = await withLock(
        versionFilePath,
        lockfilePath,
        async () => {
          try {
            await callback()
          } catch (error) {
            logError(error)
            throw error
          }
        },
      )

      if (success) {
        logEvent('tengu_version_lock_acquired', {
          is_pid_based: true,
          is_lifetime_lock: false,
          attempts: attempts + 1,
        })
        return true
      }

      attempts++
      if (attempts < maxAttempts) {
        // Wait before retrying with exponential backoff
        const timeout = Math.min(
          minTimeout * Math.pow(2, attempts - 1),
          maxTimeout,
        )
        await sleep(timeout)
      }
    }

    logEvent('tengu_version_lock_failed', {
      is_pid_based: true,
      is_lifetime_lock: false,
      attempts: maxAttempts,
    })
    logLockAcquisitionError(
      versionFilePath,
      new Error('Lock held by another process'),
    )
    return false
  }

  // Use mtime-based locking (proper-lockfile) with 30-day stale timeout
  let release: (() => Promise<void>) | null = null
  try {
    // Lock acquisition phase - catch lock errors and return false
    // Use 30 days for stale to match lockCurrentVersion() - this ensures we never
    // consider a running process's lock as stale during normal usage (including
    // laptop sleep). 30 days allows eventual cleanup of abandoned locks from
    // crashed processes while being long enough for any realistic session.
    try {
      release = await lockfile.lock(versionFilePath, {
        stale: LOCK_STALE_MS,
        retries: {
          retries,
          minTimeout: retries > 0 ? 1000 : 100,
          maxTimeout: retries > 0 ? 5000 : 500,
        },
        lockfilePath,
        // Handle lock compromise gracefully to prevent unhandled rejections
        // This can happen if another process deletes the lock directory while we hold it
        onCompromised: (err: Error) => {
          logForDebugging(
            `NON-FATAL: Version lock was compromised during operation: ${err.message}`,
            { level: 'info' },
          )
        },
      })
    } catch (lockError) {
      logEvent('tengu_version_lock_failed', {
        is_pid_based: false,
        is_lifetime_lock: false,
      })
      logLockAcquisitionError(versionFilePath, lockError)
      return false
    }

    // Operation phase - log errors but let them propagate
    try {
      await callback()
      logEvent('tengu_version_lock_acquired', {
        is_pid_based: false,
        is_lifetime_lock: false,
      })
      return true
    } catch (error) {
      logError(error)
      throw error
    }
  } finally {
    if (release) {
      await release()
    }
  }
}

async function atomicMoveToInstallPath(
  stagedBinaryPath: string,
  installPath: string,
) {
  // Create installation directory if it doesn't exist
  await mkdir(dirname(installPath), { recursive: true })

  // Move from staging to final location atomically
  const tempInstallPath = `${installPath}.tmp.${process.pid}.${Date.now()}`

  try {
    // Copy to temp next to install path, then rename. A direct rename from staging
    // would fail with EXDEV if staging and install are on different filesystems.
    await copyFile(stagedBinaryPath, tempInstallPath)
    await chmod(tempInstallPath, 0o755)
    await rename(tempInstallPath, installPath)
    logForDebugging(`Atomically installed binary to ${installPath}`)
  } catch (error) {
    // Clean up temp file if it exists
    try {
      await unlink(tempInstallPath)
    } catch {
      // Ignore cleanup errors
    }
    throw error
  }
}

async function installVersionFromPackage(
  stagingPath: string,
  installPath: string,
) {
  try {
    // Extract binary from npm package structure in staging
    const nodeModulesDir = join(stagingPath, 'node_modules', '@anthropic-ai')
    const entries = await readdir(nodeModulesDir)
    const nativePackage = entries.find((entry: string) =>
      entry.startsWith('claude-cli-native-'),
    )

    if (!nativePackage) {
      logEvent('tengu_native_install_package_failure', {
        stage_find_package: true,
        error_package_not_found: true,
      })
      const error = new Error('Could not find platform-specific native package')
      throw error
    }

    const stagedBinaryPath = join(nodeModulesDir, nativePackage, 'cli')

    try {
      await stat(stagedBinaryPath)
    } catch {
      logEvent('tengu_native_install_package_failure', {
        stage_binary_exists: true,
        error_binary_not_found: true,
      })
      const error = new Error('Native binary not found in staged package')
      throw error
    }

    await atomicMoveToInstallPath(stagedBinaryPath, installPath)

    // Clean up staging directory
    await rm(stagingPath, { recursive: true, force: true })

    logEvent('tengu_native_install_package_success', {})
  } catch (error) {
    // Log if not already logged above
    const msg = errorMessage(error)
    if (
      !msg.includes('Could not find platform-specific') &&
      !msg.includes('Native binary not found')
    ) {
      logEvent('tengu_native_install_package_failure', {
        stage_atomic_move: true,
        error_move_failed: true,
      })
    }
    logError(toError(error))
    throw error
  }
}

async function installVersionFromBinary(
  stagingPath: string,
  installPath: string,
) {
  try {
    // For direct binary downloads (GCS, generic bucket), the binary is directly in staging
    const platform = getPlatform()
    const binaryName = getBinaryName(platform)
    const stagedBinaryPath = join(stagingPath, binaryName)

    try {
      await stat(stagedBinaryPath)
    } catch {
      logEvent('tengu_native_install_binary_failure', {
        stage_binary_exists: true,
        error_binary_not_found: true,
      })
      const error = new Error('Staged binary not found')
      throw error
    }

    await atomicMoveToInstallPath(stagedBinaryPath, installPath)

    // Clean up staging directory
    await rm(stagingPath, { recursive: true, force: true })

    logEvent('tengu_native_install_binary_success', {})
  } catch (error) {
    if (!errorMessage(error).includes('Staged binary not found')) {
      logEvent('tengu_native_install_binary_failure', {
        stage_atomic_move: true,
        error_move_failed: true,
      })
    }
    logError(toError(error))
    throw error
  }
}

async function installVersion(
  stagingPath: string,
  installPath: string,
  downloadType: 'npm' | 'binary',
) {
  // Use the explicit download type instead of guessing
  if (downloadType === 'npm') {
    await installVersionFromPackage(stagingPath, installPath)
  } else {
    await installVersionFromBinary(stagingPath, installPath)
  }
}

/**
 * Performs the core update operation: download (if needed), install, and update symlink.
 * Returns whether a new install was performed (vs just updating symlink).
 */
async function performVersionUpdate(
  version: string,
  forceReinstall: boolean,
): Promise<boolean> {
  const { stagingPath: baseStagingPath, installPath } =
    await getVersionPaths(version)
  const { executable: executablePath } = getBaseDirectories()

  // For lockless updates, use a unique staging path to avoid conflicts between concurrent downloads
  const stagingPath = isEnvTruthy(process.env.ENABLE_LOCKLESS_UPDATES)
    ? `${baseStagingPath}.${process.pid}.${Date.now()}`
    : baseStagingPath

  // Only download if not already installed (or if force reinstall)
  const needsInstall = !(await versionIsAvailable(version)) || forceReinstall
  if (needsInstall) {
    logForDebugging(
      forceReinstall
        ? `Force reinstalling native installer version ${version}`
        : `Downloading native installer version ${version}`,
    )
    const downloadType = await downloadVersion(version, stagingPath)
    await installVersion(stagingPath, installPath, downloadType)
  } else {
    logForDebugging(`Version ${version} already installed, updating symlink`)
  }

  // Create direct symlink from ~/.local/bin/claude to the version binary
  await removeDirectoryIfEmpty(executablePath)
  await updateSymlink(executablePath, installPath)

  // Verify the executable was actually created/updated
  if (!(await isPossibleClaudeBinary(executablePath))) {
    let installPathExists = false
    try {
      await stat(installPath)
      installPathExists = true
    } catch {
      // installPath doesn't exist
    }
    throw new Error(
      `Failed to create executable at ${executablePath}. ` +
        `Source file exists: ${installPathExists}. ` +
        `Check write permissions to ${executablePath}.`,
    )
  }
  return needsInstall
}

async function versionIsAvailable(version: string): Promise<boolean> {
  const { installPath } = await getVersionPaths(version)
  return isPossibleClaudeBinary(installPath)
}

async function updateLatest(
  channelOrVersion: string,
  forceReinstall: boolean = false,
): Promise<{
  success: boolean
  latestVersion: string
  lockFailed?: boolean
  lockHolderPid?: number
}> {
  const startTime = Date.now()
  let version = await getLatestVersion(channelOrVersion)
  const { executable: executablePath } = getBaseDirectories()

  logForDebugging(`Checking for native installer update to version ${version}`)

  // Check if max version is set (server-side kill switch for auto-updates)
  if (!forceReinstall) {
    const maxVersion = await getMaxVersion()
    if (maxVersion && gt(version, maxVersion)) {
      logForDebugging(
        `Native installer: maxVersion ${maxVersion} is set, capping update from ${version} to ${maxVersion}`,
      )
      // If we're already at or above maxVersion, skip the update entirely
      if (gte(MACRO.VERSION, maxVersion)) {
        logForDebugging(
          `Native installer: current version ${MACRO.VERSION} is already at or above maxVersion ${maxVersion}, skipping update`,
        )
        logEvent('tengu_native_update_skipped_max_version', {
          latency_ms: Date.now() - startTime,
          max_version:
            maxVersion as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          available_version:
            version as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        })
        return { success: true, latestVersion: version }
      }
      version = maxVersion
    }
  }

  // Early exit: if we're already running this exact version AND both the version binary
  // and executable exist and are valid. We need to proceed if the executable doesn't exist,
  // is invalid (e.g., empty/corrupted from a failed install), or we're running via npx.
  if (
    !forceReinstall &&
    version === MACRO.VERSION &&
    (await versionIsAvailable(version)) &&
    (await isPossibleClaudeBinary(executablePath))
  ) {
    logForDebugging(`Found ${version} at ${executablePath}, skipping install`)
    logEvent('tengu_native_update_complete', {
      latency_ms: Date.now() - startTime,
      was_new_install: false,
      was_force_reinstall: false,
      was_already_running: true,
    })
    return { success: true, latestVersion: version }
  }

  // Check if this version should be skipped due to minimumVersion setting
  if (!forceReinstall && shouldSkipVersion(version)) {
    logEvent('tengu_native_update_skipped_minimum_version', {
      latency_ms: Date.now() - startTime,
      target_version:
        version as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
    return { success: true, latestVersion: version }
  }

  // Track if we're actually installing or just symlinking
  let wasNewInstall = false
  let latencyMs: number

  if (isEnvTruthy(process.env.ENABLE_LOCKLESS_UPDATES)) {
    // Lockless: rely on atomic operations, errors propagate
    wasNewInstall = await performVersionUpdate(version, forceReinstall)
    latencyMs = Date.now() - startTime
  } else {
    // Lock-based updates
    const { installPath } = await getVersionPaths(version)
    // If force reinstall, remove any existing lock to bypass stale locks
    if (forceReinstall) {
      await forceRemoveLock(installPath)
    }

    const lockAcquired = await tryWithVersionLock(
      installPath,
      async () => {
        wasNewInstall = await performVersionUpdate(version, forceReinstall)
      },
      3, // retries
    )

    latencyMs = Date.now() - startTime

    // Lock acquisition failed - get lock holder PID for error message
    if (!lockAcquired) {
      const dirs = getBaseDirectories()
      let lockHolderPid: number | undefined
      if (isPidBasedLockingEnabled()) {
        const lockfilePath = getLockFilePathFromVersionPath(dirs, installPath)
        if (isLockActive(lockfilePath)) {
          lockHolderPid = readLockContent(lockfilePath)?.pid
        }
      }
      logEvent('tengu_native_update_lock_failed', {
        latency_ms: latencyMs,
        lock_holder_pid: lockHolderPid,
      })
      return {
        success: false,
        latestVersion: version,
        lockFailed: true,
        lockHolderPid,
      }
    }
  }

  logEvent('tengu_native_update_complete', {
    latency_ms: latencyMs,
    was_new_install: wasNewInstall,
    was_force_reinstall: forceReinstall,
  })
  logForDebugging(`Successfully updated to version ${version}`)
  return { success: true, latestVersion: version }
}

// Exported for testing
export async function removeDirectoryIfEmpty(path: string): Promise<void> {
  // rmdir alone handles all cases: ENOTDIR if path is a file, ENOTEMPTY if
  // directory is non-empty, ENOENT if missing. No need to stat+readdir first.
  try {
    await rmdir(path)
    logForDebugging(`Removed empty directory at ${path}`)
  } catch (error) {
    const code = getErrnoCode(error)
    // Expected cases (not-a-dir, missing, not-empty) — silently skip.
    // ENOTDIR is the normal path: executablePath is typically a symlink.
    if (code !== 'ENOTDIR' && code !== 'ENOENT' && code !== 'ENOTEMPTY') {
      logForDebugging(`Could not remove directory at ${path}: ${error}`)
    }
  }
}

async function updateSymlink(
  symlinkPath: string,
  targetPath: string,
): Promise<boolean> {
  const platform = getPlatform()
  const isWindows = platform.startsWith('win32')

  // On Windows, directly copy the executable instead of creating a symlink
  if (isWindows) {
    try {
      // Ensure parent directory exists
      const parentDir = dirname(symlinkPath)
      await mkdir(parentDir, { recursive: true })

      // Check if file already exists and has same content
      let existingStats: Stats | undefined
      try {
        existingStats = await stat(symlinkPath)
      } catch {
        // symlinkPath doesn't exist
      }

      if (existingStats) {
        try {
          const targetStats = await stat(targetPath)
          // If sizes match, assume files are the same (avoid reading large files)
          if (existingStats.size === targetStats.size) {
            return false
          }
        } catch {
          // Continue with copy if we can't compare
        }
        // Use rename strategy to handle file locking on Windows
        // Rename always works even for running executables, unlike delete
        const oldFileName = `${symlinkPath}.old.${Date.now()}`
        await rename(symlinkPath, oldFileName)

        // Try to copy new executable, with rollback on failure
        try {
          await copyFile(targetPath, symlinkPath)
          // Success - try immediate cleanup of old file (non-blocking)
          try {
            await unlink(oldFileName)
          } catch {
            // File still running - ignore, Windows will clean up eventually
          }
        } catch (copyError) {
          // Copy failed - restore the old executable
          try {
            await rename(oldFileName, symlinkPath)
          } catch (restoreError) {
            // Critical: User left without working executable - prioritize restore error
            const errorWithCause = new Error(
              `Failed to restore old executable: ${restoreError}`,
              { cause: copyError },
            )
            logError(errorWithCause)
            throw errorWithCause
          }
          throw copyError
        }
      } else {
        // First-time installation (no existing file to rename)
        // Copy the executable directly; handle ENOENT from copyFile itself
        // rather than a stat() pre-check (avoids TOCTOU + extra syscall)
        try {
          await copyFile(targetPath, symlinkPath)
        } catch (e) {
          if (isENOENT(e)) {
            throw new Error(`Source file does not exist: ${targetPath}`)
          }
          throw e
        }
      }
      // chmod is not needed on Windows - executability is determined by .exe extension
      return true
    } catch (error) {
      logError(
        new Error(
          `Failed to copy executable from ${targetPath} to ${symlinkPath}: ${error}`,
        ),
      )
      return false
    }
  }

  // For non-Windows platforms, use symlinks as before
  // Ensure parent directory exists (same as Windows path above)
  const parentDir = dirname(symlinkPath)
  try {
    await mkdir(parentDir, { recursive: true })
    logForDebugging(`Created directory ${parentDir} for symlink`)
  } catch (mkdirError) {
    logError(
      new Error(`Failed to create directory ${parentDir}: ${mkdirError}`),
    )
    return false
  }

  // Check if symlink already exists and points to the correct target
  try {
    let symlinkExists = false
    try {
      await stat(symlinkPath)
      symlinkExists = true
    } catch {
      // symlinkPath doesn't exist
    }

    if (symlinkExists) {
      try {
        const currentTarget = await readlink(symlinkPath)
        const resolvedCurrentTarget = resolve(
          dirname(symlinkPath),
          currentTarget,
        )
        const resolvedTargetPath = resolve(targetPath)

        if (resolvedCurrentTarget === resolvedTargetPath) {
          return false
        }
      } catch {
        // Path exists but is not a symlink - will remove it below
      }

      // Remove existing file/symlink before creating new one
      await unlink(symlinkPath)
    }
  } catch (error) {
    logError(new Error(`Failed to check/remove existing symlink: ${error}`))
  }

  // Use atomic rename to avoid race conditions. Create symlink with temporary name
  // then atomically rename to final name. This ensures the symlink always exists
  // and is always valid, even with concurrent updates.
  const tempSymlink = `${symlinkPath}.tmp.${process.pid}.${Date.now()}`
  try {
    await symlink(targetPath, tempSymlink)

    // Atomically rename to final name (replaces existing)
    await rename(tempSymlink, symlinkPath)
    logForDebugging(
      `Atomically updated symlink ${symlinkPath} -> ${targetPath}`,
    )
    return true
  } catch (error) {
    // Clean up temp symlink if it exists
    try {
      await unlink(tempSymlink)
    } catch {
      // Ignore cleanup errors
    }
    logError(
      new Error(
        `Failed to create symlink from ${symlinkPath} to ${targetPath}: ${error}`,
      ),
    )
    return false
  }
}

export async function checkInstall(
  force: boolean = false,
): Promise<SetupMessage[]> {
  // Skip all installation checks if disabled via environment variable
  if (isEnvTruthy(process.env.DISABLE_INSTALLATION_CHECKS)) {
    return []
  }

  // Get the actual installation type and config
  const installationType = await getCurrentInstallationType()

  // Skip checks for development builds - config.installMethod from a previous
  // native installation shouldn't trigger warnings when running dev builds
  if (installationType === 'development') {
    return []
  }

  const config = getGlobalConfig()

  // Only show warnings if:
  // 1. User is actually running from native installation, OR
  // 2. User has explicitly set installMethod to 'native' in config (they're trying to use native)
  // 3. force is true (used during installation process)
  const shouldCheckNative =
    force || installationType === 'native' || config.installMethod === 'native'

  if (!shouldCheckNative) {
    return []
  }

  const dirs = getBaseDirectories()
  const messages: SetupMessage[] = []
  const localBinDir = dirname(dirs.executable)
  const resolvedLocalBinPath = resolve(localBinDir)
  const platform = getPlatform()
  const isWindows = platform.startsWith('win32')

  // Check if bin directory exists
  try {
    await access(localBinDir)
  } catch {
    messages.push({
      message: `installMethod is native, but directory ${localBinDir} does not exist`,
      userActionRequired: true,
      type: 'error',
    })
  }

  // Check if claude executable exists and is valid.
  // On non-Windows, call readlink directly and route errno — ENOENT means
  // the executable is missing, EINVAL means it exists but isn't a symlink.
  // This avoids an access()→readlink() TOCTOU where deletion between the
  // two calls produces a misleading "Not a symlink" diagnostic.
  // isPossibleClaudeBinary stats the path internally, so we don't pre-check
  // with access() — that would be a TOCTOU between access and the stat.
  if (isWindows) {
    // On Windows it's a copied executable, not a symlink
    if (!(await isPossibleClaudeBinary(dirs.executable))) {
      messages.push({
        message: `installMethod is native, but claude command is missing or invalid at ${dirs.executable}`,
        userActionRequired: true,
        type: 'error',
      })
    }
  } else {
    try {
      const target = await readlink(dirs.executable)
      const absoluteTarget = resolve(dirname(dirs.executable), target)
      if (!(await isPossibleClaudeBinary(absoluteTarget))) {
        messages.push({
          message: `Claude symlink points to missing or invalid binary: ${target}`,
          userActionRequired: true,
          type: 'error',
        })
      }
    } catch (e) {
      if (isENOENT(e)) {
        messages.push({
          message: `installMethod is native, but claude command not found at ${dirs.executable}`,
          userActionRequired: true,
          type: 'error',
        })
      } else {
        // EINVAL (not a symlink) or other — check as regular binary
        if (!(await isPossibleClaudeBinary(dirs.executable))) {
          messages.push({
            message: `${dirs.executable} exists but is not a valid Claude binary`,
            userActionRequired: true,
            type: 'error',
          })
        }
      }
    }
  }

  // Check if bin directory is in PATH
  const isInCurrentPath = (process.env.PATH || '')
    .split(delimiter)
    .some(entry => {
      try {
        const resolvedEntry = resolve(entry)
        // On Windows, perform case-insensitive comparison for paths
        if (isWindows) {
          return (
            resolvedEntry.toLowerCase() === resolvedLocalBinPath.toLowerCase()
          )
        }
        return resolvedEntry === resolvedLocalBinPath
      } catch {
        return false
      }
    })

  if (!isInCurrentPath) {
    if (isWindows) {
      // Windows-specific PATH instructions
      const windowsBinPath = localBinDir.replace(/\//g, '\\')
      messages.push({
        message: `Native installation exists but ${windowsBinPath} is not in your PATH. Add it by opening: System Properties → Environment Variables → Edit User PATH → New → Add the path above. Then restart your terminal.`,
        userActionRequired: true,
        type: 'path',
      })
    } else {
      // Unix-style PATH instructions
      const shellType = getShellType()
      const configPaths = getShellConfigPaths()
      const configFile = configPaths[shellType as keyof typeof configPaths]
      const displayPath = configFile
        ? configFile.replace(homedir(), '~')
        : 'your shell config file'

      messages.push({
        message: `Native installation exists but ~/.local/bin is not in your PATH. Run:\n\necho 'export PATH="$HOME/.local/bin:$PATH"' >> ${displayPath} && source ${displayPath}`,
        userActionRequired: true,
        type: 'path',
      })
    }
  }

  return messages
}

type InstallLatestResult = {
  latestVersion: string | null
  wasUpdated: boolean
  lockFailed?: boolean
  lockHolderPid?: number
}

// In-process singleflight guard. NativeAutoUpdater remounts whenever the
// prompt suggestions overlay toggles (PromptInput.tsx:2916), and the
// isUpdating guard does not survive the remount. Each remount kicked off a
// fresh 271MB binary download while previous ones were still in flight.
// Telemetry: session 42fed33f saw arrayBuffers climb to 91GB at ~650MB/s.
let inFlightInstall: Promise<InstallLatestResult> | null = null

export function installLatest(
  channelOrVersion: string,
  forceReinstall: boolean = false,
): Promise<InstallLatestResult> {
  if (forceReinstall) {
    return installLatestImpl(channelOrVersion, forceReinstall)
  }
  if (inFlightInstall) {
    logForDebugging('installLatest: joining in-flight call')
    return inFlightInstall
  }
  const promise = installLatestImpl(channelOrVersion, forceReinstall)
  inFlightInstall = promise
  const clear = (): void => {
    inFlightInstall = null
  }
  void promise.then(clear, clear)
  return promise
}

async function installLatestImpl(
  channelOrVersion: string,
  forceReinstall: boolean = false,
): Promise<InstallLatestResult> {
  const updateResult = await updateLatest(channelOrVersion, forceReinstall)

  if (!updateResult.success) {
    return {
      latestVersion: null,
      wasUpdated: false,
      lockFailed: updateResult.lockFailed,
      lockHolderPid: updateResult.lockHolderPid,
    }
  }

  // Installation succeeded (early return above covers failure). Mark as native
  // and disable legacy auto-updater to protect symlinks.
  const config = getGlobalConfig()
  if (config.installMethod !== 'native') {
    saveGlobalConfig(current => ({
      ...current,
      installMethod: 'native',
      // Disable legacy auto-updater to prevent npm sessions from deleting native symlinks.
      // Native installations use NativeAutoUpdater instead, which respects native installation.
      autoUpdates: false,
      // Mark this as protection-based, not user preference
      autoUpdatesProtectedForNative: true,
    }))
    logForDebugging(
      'Native installer: Set installMethod to "native" and disabled legacy auto-updater for protection',
    )
  }

  void cleanupOldVersions()

  return {
    latestVersion: updateResult.latestVersion,
    wasUpdated: updateResult.success,
    lockFailed: false,
  }
}

async function getVersionFromSymlink(
  symlinkPath: string,
): Promise<string | null> {
  try {
    const target = await readlink(symlinkPath)
    const absoluteTarget = resolve(dirname(symlinkPath), target)
    if (await isPossibleClaudeBinary(absoluteTarget)) {
      return absoluteTarget
    }
  } catch {
    // Not a symlink / doesn't exist / target doesn't exist
  }
  return null
}

function getLockFilePathFromVersionPath(
  dirs: ReturnType<typeof getBaseDirectories>,
  versionPath: string,
) {
  const versionName = basename(versionPath)
  return join(dirs.locks, `${versionName}.lock`)
}

/**
 * Acquire a lock on the current running version to prevent it from being deleted
 * This lock is held for the entire lifetime of the process
 *
 * Uses PID-based locking (when enabled) which can immediately detect crashed processes
 * (unlike mtime-based locking which requires a 30-day timeout)
 */
export async function lockCurrentVersion(): Promise<void> {
  const dirs = getBaseDirectories()

  // Only lock if we're running from the versions directory
  if (!process.execPath.includes(dirs.versions)) {
    return
  }

  const versionPath = resolve(process.execPath)
  try {
    const lockfilePath = getLockFilePathFromVersionPath(dirs, versionPath)

    // Ensure locks directory exists
    await mkdir(dirs.locks, { recursive: true })

    if (isPidBasedLockingEnabled()) {
      // Acquire PID-based lock and hold it for the process lifetime
      // PID-based locking allows immediate detection of crashed processes
      // while still surviving laptop sleep (process is suspended but PID exists)
      const acquired = await acquireProcessLifetimeLock(
        versionPath,
        lockfilePath,
      )

      if (!acquired) {
        logEvent('tengu_version_lock_failed', {
          is_pid_based: true,
          is_lifetime_lock: true,
        })
        logLockAcquisitionError(
          versionPath,
          new Error('Lock already held by another process'),
        )
        return
      }

      logEvent('tengu_version_lock_acquired', {
        is_pid_based: true,
        is_lifetime_lock: true,
      })
      logForDebugging(`Acquired PID lock on running version: ${versionPath}`)
    } else {
      // Acquire mtime-based lock and never release it (until process exits)
      // Use 30 days for stale to prevent the lock from being considered stale during
      // normal usage. This is critical because laptop sleep suspends the process,
      // stopping the mtime heartbeat. 30 days is long enough for any realistic session
      // while still allowing eventual cleanup of abandoned locks.
      let release: (() => Promise<void>) | undefined
      try {
        release = await lockfile.lock(versionPath, {
          stale: LOCK_STALE_MS,
          retries: 0, // Don't retry - if we can't lock, that's fine
          lockfilePath,
          // Handle lock compromise gracefully (e.g., if another process deletes the lock directory)
          onCompromised: (err: Error) => {
            logForDebugging(
              `NON-FATAL: Lock on running version was compromised: ${err.message}`,
              { level: 'info' },
            )
          },
        })
        logEvent('tengu_version_lock_acquired', {
          is_pid_based: false,
          is_lifetime_lock: true,
        })
        logForDebugging(
          `Acquired mtime-based lock on running version: ${versionPath}`,
        )

        // Release lock explicitly; proper-lockfile's cleanup is unreliable with signal-exit v3+v4
        registerCleanup(async () => {
          try {
            await release?.()
          } catch {
            // Lock may already be released
          }
        })
      } catch (lockError) {
        if (isENOENT(lockError)) {
          logForDebugging(
            `Cannot lock current version - file does not exist: ${versionPath}`,
            { level: 'info' },
          )
          return
        }
        logEvent('tengu_version_lock_failed', {
          is_pid_based: false,
          is_lifetime_lock: true,
        })
        logLockAcquisitionError(versionPath, lockError)
        return
      }
    }
  } catch (error) {
    if (isENOENT(error)) {
      logForDebugging(
        `Cannot lock current version - file does not exist: ${versionPath}`,
        { level: 'info' },
      )
      return
    }
    // We fallback to previous behavior where we don't acquire a lock on a running version
    // This ~mostly works but using native binaries like ripgrep will fail
    logForDebugging(
      `NON-FATAL: Failed to lock current version during execution ${errorMessage(error)}`,
      { level: 'info' },
    )
  }
}

function logLockAcquisitionError(versionPath: string, lockError: unknown) {
  logError(
    new Error(
      `NON-FATAL: Lock acquisition failed for ${versionPath} (expected in multi-process scenarios)`,
      { cause: lockError },
    ),
  )
}

/**
 * Force-remove a lock file for a given version path.
 * Used when --force is specified to bypass stale locks.
 */
async function forceRemoveLock(versionFilePath: string): Promise<void> {
  const dirs = getBaseDirectories()
  const lockfilePath = getLockFilePathFromVersionPath(dirs, versionFilePath)

  try {
    await unlink(lockfilePath)
    logForDebugging(`Force-removed lock file at ${lockfilePath}`)
  } catch (error) {
    // Log but don't throw - we'll try to acquire the lock anyway
    logForDebugging(`Failed to force-remove lock file: ${errorMessage(error)}`)
  }
}

export async function cleanupOldVersions(): Promise<void> {
  // Yield to ensure we don't block startup
  await Promise.resolve()

  const dirs = getBaseDirectories()
  const oneHourAgo = Date.now() - 3600000

  // Clean up old renamed executables on Windows (no longer running at startup)
  if (getPlatform().startsWith('win32')) {
    const executableDir = dirname(dirs.executable)
    try {
      const files = await readdir(executableDir)
      let cleanedCount = 0
      for (const file of files) {
        if (!/^claude\.exe\.old\.\d+$/.test(file)) continue
        try {
          await unlink(join(executableDir, file))
          cleanedCount++
        } catch {
          // File might still be in use by another process
        }
      }
      if (cleanedCount > 0) {
        logForDebugging(
          `Cleaned up ${cleanedCount} old Windows executables on startup`,
        )
      }
    } catch (error) {
      if (!isENOENT(error)) {
        logForDebugging(`Failed to clean up old Windows executables: ${error}`)
      }
    }
  }

  // Clean up orphaned staging directories older than 1 hour
  try {
    const stagingEntries = await readdir(dirs.staging)
    let stagingCleanedCount = 0
    for (const entry of stagingEntries) {
      const stagingPath = join(dirs.staging, entry)
      try {
        // stat() is load-bearing here (we need mtime). There is a theoretical
        // TOCTOU where a concurrent installer could freshen a stale staging
        // dir between stat and rm — but the 1-hour threshold makes this
        // vanishingly unlikely, and rm({force:true}) tolerates concurrent
        // deletion.
        const stats = await stat(stagingPath)
        if (stats.mtime.getTime() < oneHourAgo) {
          await rm(stagingPath, { recursive: true, force: true })
          stagingCleanedCount++
          logForDebugging(`Cleaned up old staging directory: ${entry}`)
        }
      } catch {
        // Ignore individual errors
      }
    }
    if (stagingCleanedCount > 0) {
      logForDebugging(
        `Cleaned up ${stagingCleanedCount} orphaned staging directories`,
      )
      logEvent('tengu_native_staging_cleanup', {
        cleaned_count: stagingCleanedCount,
      })
    }
  } catch (error) {
    if (!isENOENT(error)) {
      logForDebugging(`Failed to clean up staging directories: ${error}`)
    }
  }

  // Clean up stale PID locks (crashed processes) — cleanupStaleLocks handles ENOENT
  if (isPidBasedLockingEnabled()) {
    const staleLocksCleaned = cleanupStaleLocks(dirs.locks)
    if (staleLocksCleaned > 0) {
      logForDebugging(`Cleaned up ${staleLocksCleaned} stale version locks`)
      logEvent('tengu_native_stale_locks_cleanup', {
        cleaned_count: staleLocksCleaned,
      })
    }
  }

  // Single readdir of versions dir. Partition into temp files vs candidate binaries,
  // stat'ing each entry at most once.
  let versionEntries: string[]
  try {
    versionEntries = await readdir(dirs.versions)
  } catch (error) {
    if (!isENOENT(error)) {
      logForDebugging(`Failed to readdir versions directory: ${error}`)
    }
    return
  }

  type VersionInfo = {
    name: string
    path: string
    resolvedPath: string
    mtime: Date
  }
  const versionFiles: VersionInfo[] = []
  let tempFilesCleanedCount = 0

  for (const entry of versionEntries) {
    const entryPath = join(dirs.versions, entry)
    if (/\.tmp\.\d+\.\d+$/.test(entry)) {
      // Orphaned temp install file — pattern: {version}.tmp.{pid}.{timestamp}
      try {
        const stats = await stat(entryPath)
        if (stats.mtime.getTime() < oneHourAgo) {
          await unlink(entryPath)
          tempFilesCleanedCount++
          logForDebugging(`Cleaned up orphaned temp install file: ${entry}`)
        }
      } catch {
        // Ignore individual errors
      }
      continue
    }
    // Candidate version binary — stat once, reuse for isFile/size/mtime/mode
    try {
      const stats = await stat(entryPath)
      if (!stats.isFile()) continue
      if (
        process.platform !== 'win32' &&
        stats.size > 0 &&
        (stats.mode & 0o111) === 0
      ) {
        // Check executability via mode bits from the existing stat result —
        // avoids a second syscall (access(X_OK)) and the TOCTOU window between
        // stat and access. Skip on Windows: libuv only sets execute bits for
        // .exe/.com/.bat/.cmd, but version files are extensionless semver
        // strings (e.g. "1.2.3"), so this check would reject all of them.
        // The previous access(X_OK) passed any readable file on Windows anyway.
        continue
      }
      versionFiles.push({
        name: entry,
        path: entryPath,
        resolvedPath: resolve(entryPath),
        mtime: stats.mtime,
      })
    } catch {
      // Skip files we can't stat
    }
  }

  if (tempFilesCleanedCount > 0) {
    logForDebugging(
      `Cleaned up ${tempFilesCleanedCount} orphaned temp install files`,
    )
    logEvent('tengu_native_temp_files_cleanup', {
      cleaned_count: tempFilesCleanedCount,
    })
  }

  if (versionFiles.length === 0) {
    return
  }

  try {
    // Identify protected versions
    const currentBinaryPath = process.execPath
    const protectedVersions = new Set<string>()
    if (currentBinaryPath && currentBinaryPath.includes(dirs.versions)) {
      protectedVersions.add(resolve(currentBinaryPath))
    }

    const currentSymlinkVersion = await getVersionFromSymlink(dirs.executable)
    if (currentSymlinkVersion) {
      protectedVersions.add(currentSymlinkVersion)
    }

    // Protect versions with active locks (running in other processes)
    for (const v of versionFiles) {
      if (protectedVersions.has(v.resolvedPath)) continue

      const lockFilePath = getLockFilePathFromVersionPath(dirs, v.resolvedPath)
      let hasActiveLock = false
      if (isPidBasedLockingEnabled()) {
        hasActiveLock = isLockActive(lockFilePath)
      } else {
        try {
          hasActiveLock = await lockfile.check(v.resolvedPath, {
            stale: LOCK_STALE_MS,
            lockfilePath: lockFilePath,
          })
        } catch {
          hasActiveLock = false
        }
      }
      if (hasActiveLock) {
        protectedVersions.add(v.resolvedPath)
        logForDebugging(`Protecting locked version from cleanup: ${v.name}`)
      }
    }

    // Eligible versions: not protected, sorted newest first (reuse cached mtime)
    const eligibleVersions = versionFiles
      .filter(v => !protectedVersions.has(v.resolvedPath))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())

    const versionsToDelete = eligibleVersions.slice(VERSION_RETENTION_COUNT)

    if (versionsToDelete.length === 0) {
      logEvent('tengu_native_version_cleanup', {
        total_count: versionFiles.length,
        deleted_count: 0,
        protected_count: protectedVersions.size,
        retained_count: VERSION_RETENTION_COUNT,
        lock_failed_count: 0,
        error_count: 0,
      })
      return
    }

    let deletedCount = 0
    let lockFailedCount = 0
    let errorCount = 0

    await Promise.all(
      versionsToDelete.map(async version => {
        try {
          const deleted = await tryWithVersionLock(version.path, async () => {
            await unlink(version.path)
          })
          if (deleted) {
            deletedCount++
          } else {
            lockFailedCount++
            logForDebugging(
              `Skipping deletion of ${version.name} - locked by another process`,
            )
          }
        } catch (error) {
          errorCount++
          logError(
            new Error(`Failed to delete version ${version.name}: ${error}`),
          )
        }
      }),
    )

    logEvent('tengu_native_version_cleanup', {
      total_count: versionFiles.length,
      deleted_count: deletedCount,
      protected_count: protectedVersions.size,
      retained_count: VERSION_RETENTION_COUNT,
      lock_failed_count: lockFailedCount,
      error_count: errorCount,
    })
  } catch (error) {
    if (!isENOENT(error)) {
      logError(new Error(`Version cleanup failed: ${error}`))
    }
  }
}

/**
 * Check if a given path is managed by npm
 * @param executablePath - The path to check (can be a symlink)
 * @returns true if the path is npm-managed, false otherwise
 */
async function isNpmSymlink(executablePath: string): Promise<boolean> {
  // Resolve symlink to its target if applicable
  let targetPath = executablePath
  const stats = await lstat(executablePath)
  if (stats.isSymbolicLink()) {
    targetPath = await realpath(executablePath)
  }

  // checking npm prefix isn't guaranteed to work, as prefix can change
  // and users may set --prefix manually when installing
  // thus we use this heuristic:
  return targetPath.endsWith('.js') || targetPath.includes('node_modules')
}

/**
 * Remove the claude symlink from the executable directory
 * This is used when switching away from native installation
 * Will only remove if it's a native binary symlink, not npm-managed JS files
 */
export async function removeInstalledSymlink(): Promise<void> {
  const dirs = getBaseDirectories()

  try {
    // Check if this is an npm-managed installation
    if (await isNpmSymlink(dirs.executable)) {
      logForDebugging(
        `Skipping removal of ${dirs.executable} - appears to be npm-managed`,
      )
      return
    }

    // It's a native binary symlink, safe to remove
    await unlink(dirs.executable)
    logForDebugging(`Removed claude symlink at ${dirs.executable}`)
  } catch (error) {
    if (isENOENT(error)) {
      return
    }
    logError(new Error(`Failed to remove claude symlink: ${error}`))
  }
}

/**
 * Clean up old claude aliases from shell configuration files
 * Only handles alias removal, not PATH setup
 */
export async function cleanupShellAliases(): Promise<SetupMessage[]> {
  const messages: SetupMessage[] = []
  const configMap = getShellConfigPaths()

  for (const [shellType, configFile] of Object.entries(configMap)) {
    try {
      const lines = await readFileLines(configFile)
      if (!lines) continue

      const { filtered, hadAlias } = filterClaudeAliases(lines)

      if (hadAlias) {
        await writeFileLines(configFile, filtered)
        messages.push({
          message: `Removed claude alias from ${configFile}. Run: unalias claude`,
          userActionRequired: true,
          type: 'alias',
        })
        logForDebugging(`Cleaned up claude alias from ${shellType} config`)
      }
    } catch (error) {
      logError(error)
      messages.push({
        message: `Failed to clean up ${configFile}: ${error}`,
        userActionRequired: false,
        type: 'error',
      })
    }
  }

  return messages
}

async function manualRemoveNpmPackage(
  packageName: string,
): Promise<{ success: boolean; error?: string; warning?: string }> {
  try {
    // Get npm global prefix
    const prefixResult = await execFileNoThrowWithCwd('npm', [
      'config',
      'get',
      'prefix',
    ])
    if (prefixResult.code !== 0 || !prefixResult.stdout) {
      return {
        success: false,
        error: 'Failed to get npm global prefix',
      }
    }

    const globalPrefix = prefixResult.stdout.trim()
    let manuallyRemoved = false

    // Helper to try removing a file. unlink alone is sufficient — it throws
    // ENOENT if the file is missing, which the catch handles identically.
    // A stat() pre-check would add a syscall and a TOCTOU window where
    // concurrent cleanup causes a false-negative return.
    async function tryRemove(filePath: string, description: string) {
      try {
        await unlink(filePath)
        logForDebugging(`Manually removed ${description}: ${filePath}`)
        return true
      } catch {
        return false
      }
    }

    if (getPlatform().startsWith('win32')) {
      // Windows - only remove executables, not the package directory
      const binCmd = join(globalPrefix, 'claude.cmd')
      const binPs1 = join(globalPrefix, 'claude.ps1')
      const binExe = join(globalPrefix, 'claude')

      if (await tryRemove(binCmd, 'bin script')) {
        manuallyRemoved = true
      }

      if (await tryRemove(binPs1, 'PowerShell script')) {
        manuallyRemoved = true
      }

      if (await tryRemove(binExe, 'bin executable')) {
        manuallyRemoved = true
      }
    } else {
      // Unix/Mac - only remove symlink, not the package directory
      const binSymlink = join(globalPrefix, 'bin', 'claude')

      if (await tryRemove(binSymlink, 'bin symlink')) {
        manuallyRemoved = true
      }
    }

    if (manuallyRemoved) {
      logForDebugging(`Successfully removed ${packageName} manually`)
      const nodeModulesPath = getPlatform().startsWith('win32')
        ? join(globalPrefix, 'node_modules', packageName)
        : join(globalPrefix, 'lib', 'node_modules', packageName)

      return {
        success: true,
        warning: `${packageName} executables removed, but node_modules directory was left intact for safety. You may manually delete it later at: ${nodeModulesPath}`,
      }
    } else {
      return { success: false }
    }
  } catch (manualError) {
    logForDebugging(`Manual removal failed: ${manualError}`, {
      level: 'error',
    })
    return {
      success: false,
      error: `Manual removal failed: ${manualError}`,
    }
  }
}

async function attemptNpmUninstall(
  packageName: string,
): Promise<{ success: boolean; error?: string; warning?: string }> {
  const { code, stderr } = await execFileNoThrowWithCwd(
    'npm',
    ['uninstall', '-g', packageName],
    // eslint-disable-next-line custom-rules/no-process-cwd -- matches original behavior
    { cwd: process.cwd() },
  )

  if (code === 0) {
    logForDebugging(`Removed global npm installation of ${packageName}`)
    return { success: true }
  } else if (stderr && !stderr.includes('npm ERR! code E404')) {
    // Check for ENOTEMPTY error and try manual removal
    if (stderr.includes('npm error code ENOTEMPTY')) {
      logForDebugging(
        `Failed to uninstall global npm package ${packageName}: ${stderr}`,
        { level: 'error' },
      )
      logForDebugging(`Attempting manual removal due to ENOTEMPTY error`)

      const manualResult = await manualRemoveNpmPackage(packageName)
      if (manualResult.success) {
        return { success: true, warning: manualResult.warning }
      } else if (manualResult.error) {
        return {
          success: false,
          error: `Failed to remove global npm installation of ${packageName}: ${stderr}. Manual removal also failed: ${manualResult.error}`,
        }
      }
    }

    // Only report as error if it's not a "package not found" error
    logForDebugging(
      `Failed to uninstall global npm package ${packageName}: ${stderr}`,
      { level: 'error' },
    )
    return {
      success: false,
      error: `Failed to remove global npm installation of ${packageName}: ${stderr}`,
    }
  }

  return { success: false } // Package not found, not an error
}

export async function cleanupNpmInstallations(): Promise<{
  removed: number
  errors: string[]
  warnings: string[]
}> {
  const errors: string[] = []
  const warnings: string[] = []
  let removed = 0

  // Always attempt to remove @anthropic-ai/claude-code
  const codePackageResult = await attemptNpmUninstall(
    '@anthropic-ai/claude-code',
  )
  if (codePackageResult.success) {
    removed++
    if (codePackageResult.warning) {
      warnings.push(codePackageResult.warning)
    }
  } else if (codePackageResult.error) {
    errors.push(codePackageResult.error)
  }

  // Also attempt to remove MACRO.PACKAGE_URL if it's defined and different
  if (MACRO.PACKAGE_URL && MACRO.PACKAGE_URL !== '@anthropic-ai/claude-code') {
    const macroPackageResult = await attemptNpmUninstall(MACRO.PACKAGE_URL)
    if (macroPackageResult.success) {
      removed++
      if (macroPackageResult.warning) {
        warnings.push(macroPackageResult.warning)
      }
    } else if (macroPackageResult.error) {
      errors.push(macroPackageResult.error)
    }
  }

  // Check for local installation at ~/.claude/local
  const localInstallDir = join(homedir(), '.claude', 'local')

  try {
    await rm(localInstallDir, { recursive: true })
    removed++
    logForDebugging(`Removed local installation at ${localInstallDir}`)
  } catch (error) {
    if (!isENOENT(error)) {
      errors.push(`Failed to remove ${localInstallDir}: ${error}`)
      logForDebugging(`Failed to remove local installation: ${error}`, {
        level: 'error',
      })
    }
  }

  return { removed, errors, warnings }
}
