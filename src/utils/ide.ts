import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import axios from 'axios'
import { execa } from 'execa'
import capitalize from 'lodash-es/capitalize.js'
import memoize from 'lodash-es/memoize.js'
import { createConnection } from 'net'
import * as os from 'os'
import { basename, join, sep as pathSeparator, resolve } from 'path'
import { logEvent } from 'src/services/analytics/index.js'
import { getIsScrollDraining, getOriginalCwd } from '../bootstrap/state.js'
import { callIdeRpc } from '../services/mcp/client.js'
import type {
  ConnectedMCPServer,
  MCPServerConnection,
} from '../services/mcp/types.js'
import { getGlobalConfig, saveGlobalConfig } from './config.js'
import { env } from './env.js'
import { getClaudeConfigHomeDir, isEnvTruthy } from './envUtils.js'
import {
  execFileNoThrow,
  execFileNoThrowWithCwd,
  execSyncWithDefaults_DEPRECATED,
} from './execFileNoThrow.js'
import { getFsImplementation } from './fsOperations.js'
import { getAncestorPidsAsync } from './genericProcessUtils.js'
import { isJetBrainsPluginInstalledCached } from './jetbrains.js'
import { logError } from './log.js'
import { getPlatform } from './platform.js'
import { lt } from './semver.js'

// Lazy: IdeOnboardingDialog.tsx pulls React/ink; only needed in interactive onboarding path
/* eslint-disable @typescript-eslint/no-require-imports */
const ideOnboardingDialog =
  (): typeof import('src/components/IdeOnboardingDialog.js') =>
    require('src/components/IdeOnboardingDialog.js')

import { createAbortController } from './abortController.js'
import { logForDebugging } from './debug.js'
import { envDynamic } from './envDynamic.js'
import { errorMessage, isFsInaccessible } from './errors.js'
/* eslint-enable @typescript-eslint/no-require-imports */
import {
  checkWSLDistroMatch,
  WindowsToWSLConverter,
} from './idePathConversion.js'
import { sleep } from './sleep.js'
import { jsonParse } from './slowOperations.js'

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

// Returns a function that lazily fetches our process's ancestor PID chain,
// caching within the closure's lifetime. Callers should scope this to a
// single detection pass — PIDs recycle and process trees change over time.
function makeAncestorPidLookup(): () => Promise<Set<number>> {
  let promise: Promise<Set<number>> | null = null
  return () => {
    if (!promise) {
      promise = getAncestorPidsAsync(process.ppid, 10).then(
        pids => new Set(pids),
      )
    }
    return promise
  }
}

type LockfileJsonContent = {
  workspaceFolders?: string[]
  pid?: number
  ideName?: string
  transport?: 'ws' | 'sse'
  runningInWindows?: boolean
  authToken?: string
}

type IdeLockfileInfo = {
  workspaceFolders: string[]
  port: number
  pid?: number
  ideName?: string
  useWebSocket: boolean
  runningInWindows: boolean
  authToken?: string
}

export type DetectedIDEInfo = {
  name: string
  port: number
  workspaceFolders: string[]
  url: string
  isValid: boolean
  authToken?: string
  ideRunningInWindows?: boolean
}

export type IdeType =
  | 'cursor'
  | 'windsurf'
  | 'vscode'
  | 'pycharm'
  | 'intellij'
  | 'webstorm'
  | 'phpstorm'
  | 'rubymine'
  | 'clion'
  | 'goland'
  | 'rider'
  | 'datagrip'
  | 'appcode'
  | 'dataspell'
  | 'aqua'
  | 'gateway'
  | 'fleet'
  | 'androidstudio'

type IdeConfig = {
  ideKind: 'vscode' | 'jetbrains'
  displayName: string
  processKeywordsMac: string[]
  processKeywordsWindows: string[]
  processKeywordsLinux: string[]
}

const supportedIdeConfigs: Record<IdeType, IdeConfig> = {
  cursor: {
    ideKind: 'vscode',
    displayName: 'Cursor',
    processKeywordsMac: ['Cursor Helper', 'Cursor.app'],
    processKeywordsWindows: ['cursor.exe'],
    processKeywordsLinux: ['cursor'],
  },
  windsurf: {
    ideKind: 'vscode',
    displayName: 'Windsurf',
    processKeywordsMac: ['Windsurf Helper', 'Windsurf.app'],
    processKeywordsWindows: ['windsurf.exe'],
    processKeywordsLinux: ['windsurf'],
  },
  vscode: {
    ideKind: 'vscode',
    displayName: 'VS Code',
    processKeywordsMac: ['Visual Studio Code', 'Code Helper'],
    processKeywordsWindows: ['code.exe'],
    processKeywordsLinux: ['code'],
  },
  intellij: {
    ideKind: 'jetbrains',
    displayName: 'IntelliJ IDEA',
    processKeywordsMac: ['IntelliJ IDEA'],
    processKeywordsWindows: ['idea64.exe'],
    processKeywordsLinux: ['idea', 'intellij'],
  },
  pycharm: {
    ideKind: 'jetbrains',
    displayName: 'PyCharm',
    processKeywordsMac: ['PyCharm'],
    processKeywordsWindows: ['pycharm64.exe'],
    processKeywordsLinux: ['pycharm'],
  },
  webstorm: {
    ideKind: 'jetbrains',
    displayName: 'WebStorm',
    processKeywordsMac: ['WebStorm'],
    processKeywordsWindows: ['webstorm64.exe'],
    processKeywordsLinux: ['webstorm'],
  },
  phpstorm: {
    ideKind: 'jetbrains',
    displayName: 'PhpStorm',
    processKeywordsMac: ['PhpStorm'],
    processKeywordsWindows: ['phpstorm64.exe'],
    processKeywordsLinux: ['phpstorm'],
  },
  rubymine: {
    ideKind: 'jetbrains',
    displayName: 'RubyMine',
    processKeywordsMac: ['RubyMine'],
    processKeywordsWindows: ['rubymine64.exe'],
    processKeywordsLinux: ['rubymine'],
  },
  clion: {
    ideKind: 'jetbrains',
    displayName: 'CLion',
    processKeywordsMac: ['CLion'],
    processKeywordsWindows: ['clion64.exe'],
    processKeywordsLinux: ['clion'],
  },
  goland: {
    ideKind: 'jetbrains',
    displayName: 'GoLand',
    processKeywordsMac: ['GoLand'],
    processKeywordsWindows: ['goland64.exe'],
    processKeywordsLinux: ['goland'],
  },
  rider: {
    ideKind: 'jetbrains',
    displayName: 'Rider',
    processKeywordsMac: ['Rider'],
    processKeywordsWindows: ['rider64.exe'],
    processKeywordsLinux: ['rider'],
  },
  datagrip: {
    ideKind: 'jetbrains',
    displayName: 'DataGrip',
    processKeywordsMac: ['DataGrip'],
    processKeywordsWindows: ['datagrip64.exe'],
    processKeywordsLinux: ['datagrip'],
  },
  appcode: {
    ideKind: 'jetbrains',
    displayName: 'AppCode',
    processKeywordsMac: ['AppCode'],
    processKeywordsWindows: ['appcode.exe'],
    processKeywordsLinux: ['appcode'],
  },
  dataspell: {
    ideKind: 'jetbrains',
    displayName: 'DataSpell',
    processKeywordsMac: ['DataSpell'],
    processKeywordsWindows: ['dataspell64.exe'],
    processKeywordsLinux: ['dataspell'],
  },
  aqua: {
    ideKind: 'jetbrains',
    displayName: 'Aqua',
    processKeywordsMac: [], // Do not auto-detect since aqua is too common
    processKeywordsWindows: ['aqua64.exe'],
    processKeywordsLinux: [],
  },
  gateway: {
    ideKind: 'jetbrains',
    displayName: 'Gateway',
    processKeywordsMac: [], // Do not auto-detect since gateway is too common
    processKeywordsWindows: ['gateway64.exe'],
    processKeywordsLinux: [],
  },
  fleet: {
    ideKind: 'jetbrains',
    displayName: 'Fleet',
    processKeywordsMac: [], // Do not auto-detect since fleet is too common
    processKeywordsWindows: ['fleet.exe'],
    processKeywordsLinux: [],
  },
  androidstudio: {
    ideKind: 'jetbrains',
    displayName: 'Android Studio',
    processKeywordsMac: ['Android Studio'],
    processKeywordsWindows: ['studio64.exe'],
    processKeywordsLinux: ['android-studio'],
  },
}

export function isVSCodeIde(ide: IdeType | null): boolean {
  if (!ide) return false
  const config = supportedIdeConfigs[ide]
  return config && config.ideKind === 'vscode'
}

export function isJetBrainsIde(ide: IdeType | null): boolean {
  if (!ide) return false
  const config = supportedIdeConfigs[ide]
  return config && config.ideKind === 'jetbrains'
}

export const isSupportedVSCodeTerminal = memoize(() => {
  return isVSCodeIde(env.terminal as IdeType)
})

export const isSupportedJetBrainsTerminal = memoize(() => {
  return isJetBrainsIde(envDynamic.terminal as IdeType)
})

export const isSupportedTerminal = memoize(() => {
  return (
    isSupportedVSCodeTerminal() ||
    isSupportedJetBrainsTerminal() ||
    Boolean(process.env.FORCE_CODE_TERMINAL)
  )
})

export function getTerminalIdeType(): IdeType | null {
  if (!isSupportedTerminal()) {
    return null
  }
  return env.terminal as IdeType
}

/**
 * Gets sorted IDE lockfiles from ~/.claude/ide directory
 * @returns Array of full lockfile paths sorted by modification time (newest first)
 */
export async function getSortedIdeLockfiles(): Promise<string[]> {
  try {
    const ideLockFilePaths = await getIdeLockfilesPaths()

    // Collect all lockfiles from all directories
    const allLockfiles: Array<{ path: string; mtime: Date }>[] =
      await Promise.all(
        ideLockFilePaths.map(async ideLockFilePath => {
          try {
            const entries = await getFsImplementation().readdir(ideLockFilePath)
            const lockEntries = entries.filter(file =>
              file.name.endsWith('.lock'),
            )
            // Stat all lockfiles in parallel; skip ones that fail
            const stats = await Promise.all(
              lockEntries.map(async file => {
                const fullPath = join(ideLockFilePath, file.name)
                try {
                  const fileStat = await getFsImplementation().stat(fullPath)
                  return { path: fullPath, mtime: fileStat.mtime }
                } catch {
                  return null
                }
              }),
            )
            return stats.filter(s => s !== null)
          } catch (error) {
            // Candidate paths are pushed without pre-checking existence, so
            // missing/inaccessible dirs are expected here — skip silently.
            if (!isFsInaccessible(error)) {
              logError(error)
            }
            return []
          }
        }),
      )

    // Flatten and sort all lockfiles by last modified date (newest first)
    return allLockfiles
      .flat()
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
      .map(file => file.path)
  } catch (error) {
    logError(error as Error)
    return []
  }
}

async function readIdeLockfile(path: string): Promise<IdeLockfileInfo | null> {
  try {
    const content = await getFsImplementation().readFile(path, {
      encoding: 'utf-8',
    })

    let workspaceFolders: string[] = []
    let pid: number | undefined
    let ideName: string | undefined
    let useWebSocket = false
    let runningInWindows = false
    let authToken: string | undefined

    try {
      const parsedContent = jsonParse(content) as LockfileJsonContent
      if (parsedContent.workspaceFolders) {
        workspaceFolders = parsedContent.workspaceFolders
      }
      pid = parsedContent.pid
      ideName = parsedContent.ideName
      useWebSocket = parsedContent.transport === 'ws'
      runningInWindows = parsedContent.runningInWindows === true
      authToken = parsedContent.authToken
    } catch (_) {
      // Older format- just a list of paths.
      workspaceFolders = content.split('\n').map(line => line.trim())
    }

    // Extract the port from the filename (e.g., 12345.lock -> 12345)
    const filename = path.split(pathSeparator).pop()
    if (!filename) return null

    const port = filename.replace('.lock', '')

    return {
      workspaceFolders,
      port: parseInt(port),
      pid,
      ideName,
      useWebSocket,
      runningInWindows,
      authToken,
    }
  } catch (error) {
    logError(error as Error)
    return null
  }
}

/**
 * Checks if the IDE connection is responding by testing if the port is open
 * @param host Host to connect to
 * @param port Port to connect to
 * @param timeout Optional timeout in milliseconds (defaults to 500ms)
 * @returns true if the port is open, false otherwise
 */
async function checkIdeConnection(
  host: string,
  port: number,
  timeout = 500,
): Promise<boolean> {
  try {
    return new Promise(resolve => {
      const socket = createConnection({
        host: host,
        port: port,
        timeout: timeout,
      })

      socket.on('connect', () => {
        socket.destroy()
        void resolve(true)
      })

      socket.on('error', () => {
        void resolve(false)
      })

      socket.on('timeout', () => {
        socket.destroy()
        void resolve(false)
      })
    })
  } catch (_) {
    // Invalid URL or other errors
    return false
  }
}

/**
 * Resolve the Windows USERPROFILE path. WSL often doesn't pass USERPROFILE
 * through, so fall back to shelling out to powershell.exe. That spawn is
 * ~500ms–2s cold; the value is static per session.
 */
const getWindowsUserProfile = memoize(async (): Promise<string | undefined> => {
  if (process.env.USERPROFILE) return process.env.USERPROFILE
  const { stdout, code } = await execFileNoThrow('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    '$env:USERPROFILE',
  ])
  if (code === 0 && stdout.trim()) return stdout.trim()
  logForDebugging(
    'Unable to get Windows USERPROFILE via PowerShell - IDE detection may be incomplete',
  )
  return undefined
})

/**
 * Gets the potential IDE lockfiles directories path based on platform.
 * Paths are not pre-checked for existence — the consumer readdirs each
 * and handles ENOENT. Pre-checking with stat() would double syscalls,
 * and on WSL (where /mnt/c access is 2-10x slower) the per-user-dir
 * stat loop compounded startup latency.
 */
export async function getIdeLockfilesPaths(): Promise<string[]> {
  const paths: string[] = [join(getClaudeConfigHomeDir(), 'ide')]

  if (getPlatform() !== 'wsl') {
    return paths
  }

  // For Windows, use heuristics to find the potential paths.
  // See https://learn.microsoft.com/en-us/windows/wsl/filesystems

  const windowsHome = await getWindowsUserProfile()

  if (windowsHome) {
    const converter = new WindowsToWSLConverter(process.env.WSL_DISTRO_NAME)
    const wslPath = converter.toLocalPath(windowsHome)
    paths.push(resolve(wslPath, '.claude', 'ide'))
  }

  // Construct the path based on the standard Windows WSL locations
  // This can fail if the current user does not have "List folder contents" permission on C:\Users
  try {
    const usersDir = '/mnt/c/Users'
    const userDirs = await getFsImplementation().readdir(usersDir)

    for (const user of userDirs) {
      // Skip files (e.g. desktop.ini) — readdir on a file path throws ENOTDIR.
      // isFsInaccessible covers ENOTDIR, but pre-filtering here avoids the
      // cost of attempting to readdir non-directories. Symlinks are kept since
      // Windows creates junction points for user profiles.
      if (!user.isDirectory() && !user.isSymbolicLink()) {
        continue
      }
      if (
        user.name === 'Public' ||
        user.name === 'Default' ||
        user.name === 'Default User' ||
        user.name === 'All Users'
      ) {
        continue // Skip system directories
      }
      paths.push(join(usersDir, user.name, '.claude', 'ide'))
    }
  } catch (error: unknown) {
    if (isFsInaccessible(error)) {
      // Expected on WSL when C: drive is not mounted or user lacks permissions
      logForDebugging(
        `WSL IDE lockfile path detection failed (${error.code}): ${errorMessage(error)}`,
      )
    } else {
      logError(error)
    }
  }
  return paths
}

/**
 * Cleans up stale IDE lockfiles
 * - Removes lockfiles for processes that are no longer running
 * - Removes lockfiles for ports that are not responding
 */
export async function cleanupStaleIdeLockfiles(): Promise<void> {
  try {
    const lockfiles = await getSortedIdeLockfiles()

    for (const lockfilePath of lockfiles) {
      const lockfileInfo = await readIdeLockfile(lockfilePath)

      if (!lockfileInfo) {
        // If we can't read the lockfile, delete it
        try {
          await getFsImplementation().unlink(lockfilePath)
        } catch (error) {
          logError(error as Error)
        }
        continue
      }

      const host = await detectHostIP(
        lockfileInfo.runningInWindows,
        lockfileInfo.port,
      )

      let shouldDelete = false

      if (lockfileInfo.pid) {
        // Check if the process is still running
        if (!isProcessRunning(lockfileInfo.pid)) {
          if (getPlatform() !== 'wsl') {
            shouldDelete = true
          } else {
            // The process id may not be reliable in wsl, so also check the connection
            const isResponding = await checkIdeConnection(
              host,
              lockfileInfo.port,
            )
            if (!isResponding) {
              shouldDelete = true
            }
          }
        }
      } else {
        // No PID, check if the URL is responding
        const isResponding = await checkIdeConnection(host, lockfileInfo.port)
        if (!isResponding) {
          shouldDelete = true
        }
      }

      if (shouldDelete) {
        try {
          await getFsImplementation().unlink(lockfilePath)
        } catch (error) {
          logError(error as Error)
        }
      }
    }
  } catch (error) {
    logError(error as Error)
  }
}

export interface IDEExtensionInstallationStatus {
  installed: boolean
  error: string | null
  installedVersion: string | null
  ideType: IdeType | null
}

export async function maybeInstallIDEExtension(
  ideType: IdeType,
): Promise<IDEExtensionInstallationStatus | null> {
  try {
    // Install/update the extension
    const installedVersion = await installIDEExtension(ideType)
    // Only track successful installations
    logEvent('tengu_ext_installed', {})

    // Set diff tool config to auto if it has not been set already
    const globalConfig = getGlobalConfig()
    if (!globalConfig.diffTool) {
      saveGlobalConfig(current => ({ ...current, diffTool: 'auto' }))
    }
    return {
      installed: true,
      error: null,
      installedVersion,
      ideType: ideType,
    }
  } catch (error) {
    logEvent('tengu_ext_install_error', {})
    // Handle installation errors
    const errorMessage = error instanceof Error ? error.message : String(error)
    logError(error as Error)
    return {
      installed: false,
      error: errorMessage,
      installedVersion: null,
      ideType: ideType,
    }
  }
}

let currentIDESearch: AbortController | null = null

export async function findAvailableIDE(): Promise<DetectedIDEInfo | null> {
  if (currentIDESearch) {
    currentIDESearch.abort()
  }
  currentIDESearch = createAbortController()
  const signal = currentIDESearch.signal

  // Clean up stale IDE lockfiles first so we don't check them at all.
  await cleanupStaleIdeLockfiles()
  const startTime = Date.now()
  while (Date.now() - startTime < 30_000 && !signal.aborted) {
    // Skip iteration during scroll drain — detectIDEs reads lockfiles +
    // shells out to ps, competing for the event loop with scroll frames.
    // Next tick after scroll settles resumes the search.
    if (getIsScrollDraining()) {
      await sleep(1000, signal)
      continue
    }
    const ides = await detectIDEs(false)
    if (signal.aborted) {
      return null
    }
    // Return the IDE if and only if there is exactly one match, otherwise the user must
    // use /ide to select an IDE. When running from a supported built-in terminal, detectIDEs()
    // should return at most one IDE.
    if (ides.length === 1) {
      return ides[0]!
    }
    await sleep(1000, signal)
  }
  return null
}

/**
 * Detects IDEs that have a running extension/plugin.
 * @param includeInvalid If true, also return IDEs that are invalid (ie. where
 * the workspace directory does not match the cwd)
 */
export async function detectIDEs(
  includeInvalid: boolean,
): Promise<DetectedIDEInfo[]> {
  const detectedIDEs: DetectedIDEInfo[] = []

  try {
    // Get the CLAUDE_CODE_SSE_PORT if set
    const ssePort = process.env.CLAUDE_CODE_SSE_PORT
    const envPort = ssePort ? parseInt(ssePort) : null

    // Get the current working directory, normalized to NFC for consistent
    // comparison. macOS returns NFD paths (decomposed Unicode), while IDEs
    // like VS Code report NFC paths (composed Unicode). Without normalization,
    // paths containing accented/CJK characters fail to match.
    const cwd = getOriginalCwd().normalize('NFC')

    // Get sorted lockfiles (full paths) and read them all in parallel.
    // findAvailableIDE() polls this every 1s for up to 30s; serial I/O here was
    // showing up as ~500ms self-time in CPU profiles.
    const lockfiles = await getSortedIdeLockfiles()
    const lockfileInfos = await Promise.all(lockfiles.map(readIdeLockfile))

    // Ancestor PID walk shells out (ps in a loop, up to 10x). Make it lazy and
    // single-shot per detectIDEs() call; with the workspace-check-first ordering
    // below, this often never fires at all.
    const getAncestors = makeAncestorPidLookup()
    const needsAncestryCheck = getPlatform() !== 'wsl' && isSupportedTerminal()

    // Try to find a lockfile that contains our current working directory
    for (const lockfileInfo of lockfileInfos) {
      if (!lockfileInfo) continue

      let isValid = false
      if (isEnvTruthy(process.env.CLAUDE_CODE_IDE_SKIP_VALID_CHECK)) {
        isValid = true
      } else if (lockfileInfo.port === envPort) {
        // If the port matches the environment variable, mark as valid regardless of directory
        isValid = true
      } else {
        // Otherwise, check if the current working directory is within the workspace folders
        isValid = lockfileInfo.workspaceFolders.some(idePath => {
          if (!idePath) return false

          let localPath = idePath

          // Handle WSL-specific path conversion and distro matching
          if (
            getPlatform() === 'wsl' &&
            lockfileInfo.runningInWindows &&
            process.env.WSL_DISTRO_NAME
          ) {
            // Check for WSL distro mismatch
            if (!checkWSLDistroMatch(idePath, process.env.WSL_DISTRO_NAME)) {
              return false
            }

            // Try both the original path and the converted path
            // This handles cases where the IDE might report either format
            const resolvedOriginal = resolve(localPath).normalize('NFC')
            if (
              cwd === resolvedOriginal ||
              cwd.startsWith(resolvedOriginal + pathSeparator)
            ) {
              return true
            }

            // Convert Windows IDE path to WSL local path and check that too
            const converter = new WindowsToWSLConverter(
              process.env.WSL_DISTRO_NAME,
            )
            localPath = converter.toLocalPath(idePath)
          }

          const resolvedPath = resolve(localPath).normalize('NFC')

          // On Windows, normalize paths for case-insensitive drive letter comparison
          if (getPlatform() === 'windows') {
            const normalizedCwd = cwd.replace(/^[a-zA-Z]:/, match =>
              match.toUpperCase(),
            )
            const normalizedResolvedPath = resolvedPath.replace(
              /^[a-zA-Z]:/,
              match => match.toUpperCase(),
            )
            return (
              normalizedCwd === normalizedResolvedPath ||
              normalizedCwd.startsWith(normalizedResolvedPath + pathSeparator)
            )
          }

          return (
            cwd === resolvedPath || cwd.startsWith(resolvedPath + pathSeparator)
          )
        })
      }

      if (!isValid && !includeInvalid) {
        continue
      }

      // PID ancestry check: when running in a supported IDE's built-in terminal,
      // ensure this lockfile's IDE is actually our parent process. This
      // disambiguates when multiple IDE windows have overlapping workspace folders.
      // Runs AFTER the workspace check so non-matching lockfiles skip it entirely —
      // previously this shelled out once per lockfile and dominated CPU profiles
      // during findAvailableIDE() polling.
      if (needsAncestryCheck) {
        const portMatchesEnv = envPort !== null && lockfileInfo.port === envPort
        if (!portMatchesEnv) {
          if (!lockfileInfo.pid || !isProcessRunning(lockfileInfo.pid)) {
            continue
          }
          if (process.ppid !== lockfileInfo.pid) {
            const ancestors = await getAncestors()
            if (!ancestors.has(lockfileInfo.pid)) {
              continue
            }
          }
        }
      }

      const ideName =
        lockfileInfo.ideName ??
        (isSupportedTerminal() ? toIDEDisplayName(envDynamic.terminal) : 'IDE')

      const host = await detectHostIP(
        lockfileInfo.runningInWindows,
        lockfileInfo.port,
      )
      let url
      if (lockfileInfo.useWebSocket) {
        url = `ws://${host}:${lockfileInfo.port}`
      } else {
        url = `http://${host}:${lockfileInfo.port}/sse`
      }

      detectedIDEs.push({
        url: url,
        name: ideName,
        workspaceFolders: lockfileInfo.workspaceFolders,
        port: lockfileInfo.port,
        isValid: isValid,
        authToken: lockfileInfo.authToken,
        ideRunningInWindows: lockfileInfo.runningInWindows,
      })
    }

    // The envPort should be defined for supported IDE terminals. If there is
    // an extension with a matching envPort, then we will single that one out
    // and return it, otherwise we return all the valid ones.
    if (!includeInvalid && envPort) {
      const envPortMatch = detectedIDEs.filter(
        ide => ide.isValid && ide.port === envPort,
      )
      if (envPortMatch.length === 1) {
        return envPortMatch
      }
    }
  } catch (error) {
    logError(error as Error)
  }

  return detectedIDEs
}

export async function maybeNotifyIDEConnected(client: Client) {
  await client.notification({
    method: 'ide_connected',
    params: {
      pid: process.pid,
    },
  })
}

export function hasAccessToIDEExtensionDiffFeature(
  mcpClients: MCPServerConnection[],
): boolean {
  // Check if there's a connected IDE client in the provided MCP clients list
  return mcpClients.some(
    client => client.type === 'connected' && client.name === 'ide',
  )
}

const EXTENSION_ID =
  process.env.USER_TYPE === 'ant'
    ? 'anthropic.claude-code-internal'
    : 'anthropic.claude-code'

export async function isIDEExtensionInstalled(
  ideType: IdeType,
): Promise<boolean> {
  if (isVSCodeIde(ideType)) {
    const command = await getVSCodeIDECommand(ideType)
    if (command) {
      try {
        const result = await execFileNoThrowWithCwd(
          command,
          ['--list-extensions'],
          {
            env: getInstallationEnv(),
          },
        )
        if (result.stdout?.includes(EXTENSION_ID)) {
          return true
        }
      } catch {
        // eat the error
      }
    }
  } else if (isJetBrainsIde(ideType)) {
    return await isJetBrainsPluginInstalledCached(ideType)
  }
  return false
}

async function installIDEExtension(ideType: IdeType): Promise<string | null> {
  if (isVSCodeIde(ideType)) {
    const command = await getVSCodeIDECommand(ideType)

    if (command) {
      if (process.env.USER_TYPE === 'ant') {
        return await installFromArtifactory(command)
      }
      let version = await getInstalledVSCodeExtensionVersion(command)
      // If it's not installed or the version is older than the one we have bundled,
      if (!version || lt(version, getClaudeCodeVersion())) {
        // `code` may crash when invoked too quickly in succession
        await sleep(500)
        const result = await execFileNoThrowWithCwd(
          command,
          ['--force', '--install-extension', 'anthropic.claude-code'],
          {
            env: getInstallationEnv(),
          },
        )
        if (result.code !== 0) {
          throw new Error(`${result.code}: ${result.error} ${result.stderr}`)
        }
        version = getClaudeCodeVersion()
      }
      return version
    }
  }
  // No automatic installation for JetBrains IDEs as it is not supported in native
  // builds. We show a prominent notice for them to download from the marketplace
  // instead.
  return null
}

function getInstallationEnv(): NodeJS.ProcessEnv | undefined {
  // Cursor on Linux may incorrectly implement
  // the `code` command and actually launch the UI.
  // Make this error out if this happens by clearing the DISPLAY
  // environment variable.
  if (getPlatform() === 'linux') {
    return {
      ...process.env,
      DISPLAY: '',
    }
  }
  return undefined
}

function getClaudeCodeVersion() {
  return MACRO.VERSION
}

async function getInstalledVSCodeExtensionVersion(
  command: string,
): Promise<string | null> {
  const { stdout } = await execFileNoThrow(
    command,
    ['--list-extensions', '--show-versions'],
    {
      env: getInstallationEnv(),
    },
  )
  const lines = stdout?.split('\n') || []
  for (const line of lines) {
    const [extensionId, version] = line.split('@')
    if (extensionId === 'anthropic.claude-code' && version) {
      return version
    }
  }
  return null
}

function getVSCodeIDECommandByParentProcess(): string | null {
  try {
    const platform = getPlatform()

    // Only supported on OSX, where Cursor has the ability to
    // register itself as the 'code' command.
    if (platform !== 'macos') {
      return null
    }

    let pid = process.ppid

    // Walk up the process tree to find the actual app
    for (let i = 0; i < 10; i++) {
      if (!pid || pid === 0 || pid === 1) break

      // Get the command for this PID
      // this function already returned if not running on macos
      const command = execSyncWithDefaults_DEPRECATED(
        // eslint-disable-next-line custom-rules/no-direct-ps-commands
        `ps -o command= -p ${pid}`,
      )?.trim()

      if (command) {
        // Check for known applications and extract the path up to and including .app
        const appNames = {
          'Visual Studio Code.app': 'code',
          'Cursor.app': 'cursor',
          'Windsurf.app': 'windsurf',
          'Visual Studio Code - Insiders.app': 'code',
          'VSCodium.app': 'codium',
        }
        const pathToExecutable = '/Contents/MacOS/Electron'

        for (const [appName, executableName] of Object.entries(appNames)) {
          const appIndex = command.indexOf(appName + pathToExecutable)
          if (appIndex !== -1) {
            // Extract the path from the beginning to the end of the .app name
            const folderPathEnd = appIndex + appName.length
            // These are all known VSCode variants with the same structure
            return (
              command.substring(0, folderPathEnd) +
              '/Contents/Resources/app/bin/' +
              executableName
            )
          }
        }
      }

      // Get parent PID
      // this function already returned if not running on macos
      const ppidStr = execSyncWithDefaults_DEPRECATED(
        // eslint-disable-next-line custom-rules/no-direct-ps-commands
        `ps -o ppid= -p ${pid}`,
      )?.trim()
      if (!ppidStr) {
        break
      }
      pid = parseInt(ppidStr.trim())
    }

    return null
  } catch {
    return null
  }
}
async function getVSCodeIDECommand(ideType: IdeType): Promise<string | null> {
  const parentExecutable = getVSCodeIDECommandByParentProcess()
  if (parentExecutable) {
    // Verify the parent executable actually exists
    try {
      await getFsImplementation().stat(parentExecutable)
      return parentExecutable
    } catch {
      // Parent executable doesn't exist
    }
  }

  // On Windows, explicitly request the .cmd wrapper. VS Code 1.110.0 began
  // prepending the install root (containing Code.exe, the Electron GUI binary)
  // to the integrated terminal's PATH ahead of bin\ (containing code.cmd, the
  // CLI wrapper) when launched via Start-Menu/Taskbar shortcuts. A bare 'code'
  // then resolves to Code.exe via PATHEXT which opens a new editor window
  // instead of running the CLI. Asking for 'code.cmd' forces cross-spawn/which
  // to skip Code.exe. See microsoft/vscode#299416 (fixed in Insiders) and
  // anthropics/claude-code#30975.
  const ext = getPlatform() === 'windows' ? '.cmd' : ''
  switch (ideType) {
    case 'vscode':
      return 'code' + ext
    case 'cursor':
      return 'cursor' + ext
    case 'windsurf':
      return 'windsurf' + ext
    default:
      break
  }
  return null
}

export async function isCursorInstalled(): Promise<boolean> {
  const result = await execFileNoThrow('cursor', ['--version'])
  return result.code === 0
}

export async function isWindsurfInstalled(): Promise<boolean> {
  const result = await execFileNoThrow('windsurf', ['--version'])
  return result.code === 0
}

export async function isVSCodeInstalled(): Promise<boolean> {
  const result = await execFileNoThrow('code', ['--help'])
  // Check if the output indicates this is actually Visual Studio Code
  return (
    result.code === 0 && Boolean(result.stdout?.includes('Visual Studio Code'))
  )
}

// Cache for IDE detection results
let cachedRunningIDEs: IdeType[] | null = null

/**
 * Internal implementation of IDE detection.
 */
async function detectRunningIDEsImpl(): Promise<IdeType[]> {
  const runningIDEs: IdeType[] = []

  try {
    const platform = getPlatform()
    if (platform === 'macos') {
      // On macOS, use ps with process name matching
      const result = await execa(
        'ps aux | grep -E "Visual Studio Code|Code Helper|Cursor Helper|Windsurf Helper|IntelliJ IDEA|PyCharm|WebStorm|PhpStorm|RubyMine|CLion|GoLand|Rider|DataGrip|AppCode|DataSpell|Aqua|Gateway|Fleet|Android Studio" | grep -v grep',
        { shell: true, reject: false },
      )
      const stdout = result.stdout ?? ''
      for (const [ide, config] of Object.entries(supportedIdeConfigs)) {
        for (const keyword of config.processKeywordsMac) {
          if (stdout.includes(keyword)) {
            runningIDEs.push(ide as IdeType)
            break
          }
        }
      }
    } else if (platform === 'windows') {
      // On Windows, use tasklist with findstr for multiple patterns
      const result = await execa(
        'tasklist | findstr /I "Code.exe Cursor.exe Windsurf.exe idea64.exe pycharm64.exe webstorm64.exe phpstorm64.exe rubymine64.exe clion64.exe goland64.exe rider64.exe datagrip64.exe appcode.exe dataspell64.exe aqua64.exe gateway64.exe fleet.exe studio64.exe"',
        { shell: true, reject: false },
      )
      const stdout = result.stdout ?? ''

      const normalizedStdout = stdout.toLowerCase()

      for (const [ide, config] of Object.entries(supportedIdeConfigs)) {
        for (const keyword of config.processKeywordsWindows) {
          if (normalizedStdout.includes(keyword.toLowerCase())) {
            runningIDEs.push(ide as IdeType)
            break
          }
        }
      }
    } else if (platform === 'linux') {
      // On Linux, use ps with process name matching
      const result = await execa(
        'ps aux | grep -E "code|cursor|windsurf|idea|pycharm|webstorm|phpstorm|rubymine|clion|goland|rider|datagrip|dataspell|aqua|gateway|fleet|android-studio" | grep -v grep',
        { shell: true, reject: false },
      )
      const stdout = result.stdout ?? ''

      const normalizedStdout = stdout.toLowerCase()

      for (const [ide, config] of Object.entries(supportedIdeConfigs)) {
        for (const keyword of config.processKeywordsLinux) {
          if (normalizedStdout.includes(keyword)) {
            if (ide !== 'vscode') {
              runningIDEs.push(ide as IdeType)
              break
            } else if (
              !normalizedStdout.includes('cursor') &&
              !normalizedStdout.includes('appcode')
            ) {
              // Special case conflicting keywords from some of the IDEs.
              runningIDEs.push(ide as IdeType)
              break
            }
          }
        }
      }
    }
  } catch (error) {
    // If process detection fails, return empty array
    logError(error as Error)
  }

  return runningIDEs
}

/**
 * Detects running IDEs and returns an array of IdeType for those that are running.
 * This performs fresh detection (~150ms) and updates the cache for subsequent
 * detectRunningIDEsCached() calls.
 */
export async function detectRunningIDEs(): Promise<IdeType[]> {
  const result = await detectRunningIDEsImpl()
  cachedRunningIDEs = result
  return result
}

/**
 * Returns cached IDE detection results, or performs detection if cache is empty.
 * Use this for performance-sensitive paths like tips where fresh results aren't needed.
 */
export async function detectRunningIDEsCached(): Promise<IdeType[]> {
  if (cachedRunningIDEs === null) {
    return detectRunningIDEs()
  }
  return cachedRunningIDEs
}

/**
 * Resets the cache for detectRunningIDEsCached.
 * Exported for testing - allows resetting state between tests.
 */
export function resetDetectRunningIDEs(): void {
  cachedRunningIDEs = null
}

export function getConnectedIdeName(
  mcpClients: MCPServerConnection[],
): string | null {
  const ideClient = mcpClients.find(
    client => client.type === 'connected' && client.name === 'ide',
  )
  return getIdeClientName(ideClient)
}

export function getIdeClientName(
  ideClient?: MCPServerConnection,
): string | null {
  const config = ideClient?.config
  return config?.type === 'sse-ide' || config?.type === 'ws-ide'
    ? config.ideName
    : isSupportedTerminal()
      ? toIDEDisplayName(envDynamic.terminal)
      : null
}

const EDITOR_DISPLAY_NAMES: Record<string, string> = {
  code: 'VS Code',
  cursor: 'Cursor',
  windsurf: 'Windsurf',
  antigravity: 'Antigravity',
  vi: 'Vim',
  vim: 'Vim',
  nano: 'nano',
  notepad: 'Notepad',
  'start /wait notepad': 'Notepad',
  emacs: 'Emacs',
  subl: 'Sublime Text',
  atom: 'Atom',
}

export function toIDEDisplayName(terminal: string | null): string {
  if (!terminal) return 'IDE'

  const config = supportedIdeConfigs[terminal as IdeType]
  if (config) {
    return config.displayName
  }

  // Check editor command names (exact match first)
  const editorName = EDITOR_DISPLAY_NAMES[terminal.toLowerCase().trim()]
  if (editorName) {
    return editorName
  }

  // Extract command name from path/arguments (e.g., "/usr/bin/code --wait" -> "code")
  const command = terminal.split(' ')[0]
  const commandName = command ? basename(command).toLowerCase() : null
  if (commandName) {
    const mappedName = EDITOR_DISPLAY_NAMES[commandName]
    if (mappedName) {
      return mappedName
    }
    // Fallback: capitalize the command basename
    return capitalize(commandName)
  }

  // Fallback: capitalize first letter
  return capitalize(terminal)
}

export { callIdeRpc }

/**
 * Gets the connected IDE client from a list of MCP clients
 * @param mcpClients - Array of wrapped MCP clients
 * @returns The connected IDE client, or undefined if not found
 */
export function getConnectedIdeClient(
  mcpClients?: MCPServerConnection[],
): ConnectedMCPServer | undefined {
  if (!mcpClients) {
    return undefined
  }

  const ideClient = mcpClients.find(
    client => client.type === 'connected' && client.name === 'ide',
  )

  // Type guard to ensure we return the correct type
  return ideClient?.type === 'connected' ? ideClient : undefined
}

/**
 * Notifies the IDE that a new prompt has been submitted.
 * This triggers IDE-specific actions like closing all diff tabs.
 */
export async function closeOpenDiffs(
  ideClient: ConnectedMCPServer,
): Promise<void> {
  try {
    await callIdeRpc('closeAllDiffTabs', {}, ideClient)
  } catch (_) {
    // Silently ignore errors when closing diff tabs
    // This prevents exceptions if the IDE doesn't support this operation
  }
}

/**
 * Initializes IDE detection and extension installation, then calls the provided callback
 * with the detected IDE information and installation status.
 * @param ideToInstallExtension The ide to install the extension to (if installing from external terminal)
 * @param onIdeDetected Callback to be called when an IDE is detected (including null)
 * @param onInstallationComplete Callback to be called when extension installation is complete
 */
export async function initializeIdeIntegration(
  onIdeDetected: (ide: DetectedIDEInfo | null) => void,
  ideToInstallExtension: IdeType | null,
  onShowIdeOnboarding: () => void,
  onInstallationComplete: (
    status: IDEExtensionInstallationStatus | null,
  ) => void,
): Promise<void> {
  // Don't await so we don't block startup, but return a promise that resolves with the status
  void findAvailableIDE().then(onIdeDetected)

  const shouldAutoInstall = getGlobalConfig().autoInstallIdeExtension ?? true
  if (
    !isEnvTruthy(process.env.CLAUDE_CODE_IDE_SKIP_AUTO_INSTALL) &&
    shouldAutoInstall
  ) {
    const ideType = ideToInstallExtension ?? getTerminalIdeType()
    if (ideType) {
      if (isVSCodeIde(ideType)) {
        void isIDEExtensionInstalled(ideType).then(async isAlreadyInstalled => {
          void maybeInstallIDEExtension(ideType)
            .catch(error => {
              const ideInstallationStatus: IDEExtensionInstallationStatus = {
                installed: false,
                error: error.message || 'Installation failed',
                installedVersion: null,
                ideType: ideType,
              }
              return ideInstallationStatus
            })
            .then(status => {
              onInstallationComplete(status)

              if (status?.installed) {
                // If we installed and don't yet have an IDE, search again.
                void findAvailableIDE().then(onIdeDetected)
              }

              if (
                !isAlreadyInstalled &&
                status?.installed === true &&
                !ideOnboardingDialog().hasIdeOnboardingDialogBeenShown()
              ) {
                onShowIdeOnboarding()
              }
            })
        })
      } else if (isJetBrainsIde(ideType)) {
        // Always check installation to populate the sync cache used by status notices
        void isIDEExtensionInstalled(ideType).then(async installed => {
          if (
            installed &&
            !ideOnboardingDialog().hasIdeOnboardingDialogBeenShown()
          ) {
            onShowIdeOnboarding()
          }
        })
      }
    }
  }
}

/**
 * Detects the host IP to use to connect to the extension.
 */
const detectHostIP = memoize(
  async (isIdeRunningInWindows: boolean, port: number) => {
    if (process.env.CLAUDE_CODE_IDE_HOST_OVERRIDE) {
      return process.env.CLAUDE_CODE_IDE_HOST_OVERRIDE
    }

    if (getPlatform() !== 'wsl' || !isIdeRunningInWindows) {
      return '127.0.0.1'
    }

    // If we are running under the WSL2 VM but the extension/plugin is running in
    // Windows, then we must use a different IP address to connect to the extension.
    // https://learn.microsoft.com/en-us/windows/wsl/networking
    try {
      const routeResult = await execa('ip route show | grep -i default', {
        shell: true,
        reject: false,
      })
      if (routeResult.exitCode === 0 && routeResult.stdout) {
        const gatewayMatch = routeResult.stdout.match(
          /default via (\d+\.\d+\.\d+\.\d+)/,
        )
        if (gatewayMatch) {
          const gatewayIP = gatewayMatch[1]!
          if (await checkIdeConnection(gatewayIP, port)) {
            return gatewayIP
          }
        }
      }
    } catch (_) {
      // Suppress any errors
    }

    // Fallback to the default if we cannot find anything
    return '127.0.0.1'
  },
  (isIdeRunningInWindows, port) => `${isIdeRunningInWindows}:${port}`,
)

async function installFromArtifactory(command: string): Promise<string> {
  // Read auth token from ~/.npmrc
  const npmrcPath = join(os.homedir(), '.npmrc')
  let authToken: string | null = null
  const fs = getFsImplementation()

  try {
    const npmrcContent = await fs.readFile(npmrcPath, {
      encoding: 'utf8',
    })
    const lines = npmrcContent.split('\n')
    for (const line of lines) {
      // Look for the artifactory auth token line
      const match = line.match(
        /\/\/artifactory\.infra\.ant\.dev\/artifactory\/api\/npm\/npm-all\/:_authToken=(.+)/,
      )
      if (match && match[1]) {
        authToken = match[1].trim()
        break
      }
    }
  } catch (error) {
    logError(error as Error)
    throw new Error(`Failed to read npm authentication: ${error}`)
  }

  if (!authToken) {
    throw new Error('No artifactory auth token found in ~/.npmrc')
  }

  // Fetch the version from artifactory
  const versionUrl =
    'https://artifactory.infra.ant.dev/artifactory/armorcode-claude-code-internal/claude-vscode-releases/stable'

  try {
    const versionResponse = await axios.get(versionUrl, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    })

    const version = versionResponse.data.trim()
    if (!version) {
      throw new Error('No version found in artifactory response')
    }

    // Download the .vsix file from artifactory
    const vsixUrl = `https://artifactory.infra.ant.dev/artifactory/armorcode-claude-code-internal/claude-vscode-releases/${version}/claude-code.vsix`
    const tempVsixPath = join(
      os.tmpdir(),
      `claude-code-${version}-${Date.now()}.vsix`,
    )

    try {
      const vsixResponse = await axios.get(vsixUrl, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        responseType: 'stream',
      })

      // Write the downloaded file to disk
      const writeStream = getFsImplementation().createWriteStream(tempVsixPath)
      await new Promise<void>((resolve, reject) => {
        vsixResponse.data.pipe(writeStream)
        writeStream.on('finish', resolve)
        writeStream.on('error', reject)
      })

      // Install the .vsix file
      // Add delay to prevent code command crashes
      await sleep(500)

      const result = await execFileNoThrowWithCwd(
        command,
        ['--force', '--install-extension', tempVsixPath],
        {
          env: getInstallationEnv(),
        },
      )

      if (result.code !== 0) {
        throw new Error(`${result.code}: ${result.error} ${result.stderr}`)
      }

      return version
    } finally {
      // Clean up the temporary file
      try {
        await fs.unlink(tempVsixPath)
      } catch {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to fetch extension version from artifactory: ${error.message}`,
      )
    }
    throw error
  }
}
