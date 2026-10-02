import { readdirSync } from 'fs'
import { stat } from 'fs/promises'
import { homedir, platform, tmpdir, userInfo } from 'os'
import { join } from 'path'
import { normalizeNameForMCP } from '../../services/mcp/normalization.js'
import { logForDebugging } from '../debug.js'
import { isFsInaccessible } from '../errors.js'
import { execFileNoThrow } from '../execFileNoThrow.js'
import { getPlatform } from '../platform.js'
import { which } from '../which.js'

export const CLAUDE_IN_CHROME_MCP_SERVER_NAME = 'claude-in-chrome'

// Re-export ChromiumBrowser type for setup.ts
export type { ChromiumBrowser } from './setupPortable.js'

// Import for local use
import type { ChromiumBrowser } from './setupPortable.js'

type BrowserConfig = {
  name: string
  macos: {
    appName: string
    dataPath: string[]
    nativeMessagingPath: string[]
  }
  linux: {
    binaries: string[]
    dataPath: string[]
    nativeMessagingPath: string[]
  }
  windows: {
    dataPath: string[]
    registryKey: string
    useRoaming?: boolean // Opera uses Roaming instead of Local
  }
}

export const CHROMIUM_BROWSERS: Record<ChromiumBrowser, BrowserConfig> = {
  chrome: {
    name: 'Google Chrome',
    macos: {
      appName: 'Google Chrome',
      dataPath: ['Library', 'Application Support', 'Google', 'Chrome'],
      nativeMessagingPath: [
        'Library',
        'Application Support',
        'Google',
        'Chrome',
        'NativeMessagingHosts',
      ],
    },
    linux: {
      binaries: ['google-chrome', 'google-chrome-stable'],
      dataPath: ['.config', 'google-chrome'],
      nativeMessagingPath: ['.config', 'google-chrome', 'NativeMessagingHosts'],
    },
    windows: {
      dataPath: ['Google', 'Chrome', 'User Data'],
      registryKey: 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts',
    },
  },
  brave: {
    name: 'Brave',
    macos: {
      appName: 'Brave Browser',
      dataPath: [
        'Library',
        'Application Support',
        'BraveSoftware',
        'Brave-Browser',
      ],
      nativeMessagingPath: [
        'Library',
        'Application Support',
        'BraveSoftware',
        'Brave-Browser',
        'NativeMessagingHosts',
      ],
    },
    linux: {
      binaries: ['brave-browser', 'brave'],
      dataPath: ['.config', 'BraveSoftware', 'Brave-Browser'],
      nativeMessagingPath: [
        '.config',
        'BraveSoftware',
        'Brave-Browser',
        'NativeMessagingHosts',
      ],
    },
    windows: {
      dataPath: ['BraveSoftware', 'Brave-Browser', 'User Data'],
      registryKey:
        'HKCU\\Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts',
    },
  },
  arc: {
    name: 'Arc',
    macos: {
      appName: 'Arc',
      dataPath: ['Library', 'Application Support', 'Arc', 'User Data'],
      nativeMessagingPath: [
        'Library',
        'Application Support',
        'Arc',
        'User Data',
        'NativeMessagingHosts',
      ],
    },
    linux: {
      // Arc is not available on Linux
      binaries: [],
      dataPath: [],
      nativeMessagingPath: [],
    },
    windows: {
      // Arc Windows is Chromium-based
      dataPath: ['Arc', 'User Data'],
      registryKey: 'HKCU\\Software\\ArcBrowser\\Arc\\NativeMessagingHosts',
    },
  },
  chromium: {
    name: 'Chromium',
    macos: {
      appName: 'Chromium',
      dataPath: ['Library', 'Application Support', 'Chromium'],
      nativeMessagingPath: [
        'Library',
        'Application Support',
        'Chromium',
        'NativeMessagingHosts',
      ],
    },
    linux: {
      binaries: ['chromium', 'chromium-browser'],
      dataPath: ['.config', 'chromium'],
      nativeMessagingPath: ['.config', 'chromium', 'NativeMessagingHosts'],
    },
    windows: {
      dataPath: ['Chromium', 'User Data'],
      registryKey: 'HKCU\\Software\\Chromium\\NativeMessagingHosts',
    },
  },
  edge: {
    name: 'Microsoft Edge',
    macos: {
      appName: 'Microsoft Edge',
      dataPath: ['Library', 'Application Support', 'Microsoft Edge'],
      nativeMessagingPath: [
        'Library',
        'Application Support',
        'Microsoft Edge',
        'NativeMessagingHosts',
      ],
    },
    linux: {
      binaries: ['microsoft-edge', 'microsoft-edge-stable'],
      dataPath: ['.config', 'microsoft-edge'],
      nativeMessagingPath: [
        '.config',
        'microsoft-edge',
        'NativeMessagingHosts',
      ],
    },
    windows: {
      dataPath: ['Microsoft', 'Edge', 'User Data'],
      registryKey: 'HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts',
    },
  },
  vivaldi: {
    name: 'Vivaldi',
    macos: {
      appName: 'Vivaldi',
      dataPath: ['Library', 'Application Support', 'Vivaldi'],
      nativeMessagingPath: [
        'Library',
        'Application Support',
        'Vivaldi',
        'NativeMessagingHosts',
      ],
    },
    linux: {
      binaries: ['vivaldi', 'vivaldi-stable'],
      dataPath: ['.config', 'vivaldi'],
      nativeMessagingPath: ['.config', 'vivaldi', 'NativeMessagingHosts'],
    },
    windows: {
      dataPath: ['Vivaldi', 'User Data'],
      registryKey: 'HKCU\\Software\\Vivaldi\\NativeMessagingHosts',
    },
  },
  opera: {
    name: 'Opera',
    macos: {
      appName: 'Opera',
      dataPath: ['Library', 'Application Support', 'com.operasoftware.Opera'],
      nativeMessagingPath: [
        'Library',
        'Application Support',
        'com.operasoftware.Opera',
        'NativeMessagingHosts',
      ],
    },
    linux: {
      binaries: ['opera'],
      dataPath: ['.config', 'opera'],
      nativeMessagingPath: ['.config', 'opera', 'NativeMessagingHosts'],
    },
    windows: {
      dataPath: ['Opera Software', 'Opera Stable'],
      registryKey:
        'HKCU\\Software\\Opera Software\\Opera Stable\\NativeMessagingHosts',
      useRoaming: true, // Opera uses Roaming AppData, not Local
    },
  },
}

// Priority order for browser detection (most common first)
export const BROWSER_DETECTION_ORDER: ChromiumBrowser[] = [
  'chrome',
  'brave',
  'arc',
  'edge',
  'chromium',
  'vivaldi',
  'opera',
]

/**
 * Get all browser data paths to check for extension installation
 */
export function getAllBrowserDataPaths(): {
  browser: ChromiumBrowser
  path: string
}[] {
  const platform = getPlatform()
  const home = homedir()
  const paths: { browser: ChromiumBrowser; path: string }[] = []

  for (const browserId of BROWSER_DETECTION_ORDER) {
    const config = CHROMIUM_BROWSERS[browserId]
    let dataPath: string[] | undefined

    switch (platform) {
      case 'macos':
        dataPath = config.macos.dataPath
        break
      case 'linux':
      case 'wsl':
        dataPath = config.linux.dataPath
        break
      case 'windows': {
        if (config.windows.dataPath.length > 0) {
          const appDataBase = config.windows.useRoaming
            ? join(home, 'AppData', 'Roaming')
            : join(home, 'AppData', 'Local')
          paths.push({
            browser: browserId,
            path: join(appDataBase, ...config.windows.dataPath),
          })
        }
        continue
      }
    }

    if (dataPath && dataPath.length > 0) {
      paths.push({
        browser: browserId,
        path: join(home, ...dataPath),
      })
    }
  }

  return paths
}

/**
 * Get native messaging host directories for all supported browsers
 */
export function getAllNativeMessagingHostsDirs(): {
  browser: ChromiumBrowser
  path: string
}[] {
  const platform = getPlatform()
  const home = homedir()
  const paths: { browser: ChromiumBrowser; path: string }[] = []

  for (const browserId of BROWSER_DETECTION_ORDER) {
    const config = CHROMIUM_BROWSERS[browserId]

    switch (platform) {
      case 'macos':
        if (config.macos.nativeMessagingPath.length > 0) {
          paths.push({
            browser: browserId,
            path: join(home, ...config.macos.nativeMessagingPath),
          })
        }
        break
      case 'linux':
      case 'wsl':
        if (config.linux.nativeMessagingPath.length > 0) {
          paths.push({
            browser: browserId,
            path: join(home, ...config.linux.nativeMessagingPath),
          })
        }
        break
      case 'windows':
        // Windows uses registry, not file paths for native messaging
        // We'll use a common location for the manifest file
        break
    }
  }

  return paths
}

/**
 * Get Windows registry keys for all supported browsers
 */
export function getAllWindowsRegistryKeys(): {
  browser: ChromiumBrowser
  key: string
}[] {
  const keys: { browser: ChromiumBrowser; key: string }[] = []

  for (const browserId of BROWSER_DETECTION_ORDER) {
    const config = CHROMIUM_BROWSERS[browserId]
    if (config.windows.registryKey) {
      keys.push({
        browser: browserId,
        key: config.windows.registryKey,
      })
    }
  }

  return keys
}

/**
 * Detect which browser to use for opening URLs
 * Returns the first available browser, or null if none found
 */
export async function detectAvailableBrowser(): Promise<ChromiumBrowser | null> {
  const platform = getPlatform()

  for (const browserId of BROWSER_DETECTION_ORDER) {
    const config = CHROMIUM_BROWSERS[browserId]

    switch (platform) {
      case 'macos': {
        // Check if the .app bundle (a directory) exists
        const appPath = `/Applications/${config.macos.appName}.app`
        try {
          const stats = await stat(appPath)
          if (stats.isDirectory()) {
            logForDebugging(
              `[Claude in Chrome] Detected browser: ${config.name}`,
            )
            return browserId
          }
        } catch (e) {
          if (!isFsInaccessible(e)) throw e
          // App not found, continue checking
        }
        break
      }
      case 'wsl':
      case 'linux': {
        // Check if any binary exists
        for (const binary of config.linux.binaries) {
          if (await which(binary).catch(() => null)) {
            logForDebugging(
              `[Claude in Chrome] Detected browser: ${config.name}`,
            )
            return browserId
          }
        }
        break
      }
      case 'windows': {
        // Check if data path exists (indicates browser is installed)
        const home = homedir()
        if (config.windows.dataPath.length > 0) {
          const appDataBase = config.windows.useRoaming
            ? join(home, 'AppData', 'Roaming')
            : join(home, 'AppData', 'Local')
          const dataPath = join(appDataBase, ...config.windows.dataPath)
          try {
            const stats = await stat(dataPath)
            if (stats.isDirectory()) {
              logForDebugging(
                `[Claude in Chrome] Detected browser: ${config.name}`,
              )
              return browserId
            }
          } catch (e) {
            if (!isFsInaccessible(e)) throw e
            // Browser not found, continue checking
          }
        }
        break
      }
    }
  }

  return null
}

export function isClaudeInChromeMCPServer(name: string): boolean {
  return normalizeNameForMCP(name) === CLAUDE_IN_CHROME_MCP_SERVER_NAME
}

const MAX_TRACKED_TABS = 200
const trackedTabIds = new Set<number>()

export function trackClaudeInChromeTabId(tabId: number): void {
  if (trackedTabIds.size >= MAX_TRACKED_TABS && !trackedTabIds.has(tabId)) {
    trackedTabIds.clear()
  }
  trackedTabIds.add(tabId)
}

export function isTrackedClaudeInChromeTabId(tabId: number): boolean {
  return trackedTabIds.has(tabId)
}

export async function openInChrome(url: string): Promise<boolean> {
  const currentPlatform = getPlatform()

  // Detect the best available browser
  const browser = await detectAvailableBrowser()

  if (!browser) {
    logForDebugging('[Claude in Chrome] No compatible browser found')
    return false
  }

  const config = CHROMIUM_BROWSERS[browser]

  switch (currentPlatform) {
    case 'macos': {
      const { code } = await execFileNoThrow('open', [
        '-a',
        config.macos.appName,
        url,
      ])
      return code === 0
    }
    case 'windows': {
      // Use rundll32 to avoid cmd.exe metacharacter issues with URLs containing & | > <
      const { code } = await execFileNoThrow('rundll32', ['url,OpenURL', url])
      return code === 0
    }
    case 'wsl':
    case 'linux': {
      for (const binary of config.linux.binaries) {
        const { code } = await execFileNoThrow(binary, [url])
        if (code === 0) {
          return true
        }
      }
      return false
    }
    default:
      return false
  }
}

/**
 * Get the socket directory path (Unix only)
 */
export function getSocketDir(): string {
  return `/tmp/claude-mcp-browser-bridge-${getUsername()}`
}

/**
 * Get the socket path (Unix) or pipe name (Windows)
 */
export function getSecureSocketPath(): string {
  if (platform() === 'win32') {
    return `\\\\.\\pipe\\${getSocketName()}`
  }
  return join(getSocketDir(), `${process.pid}.sock`)
}

/**
 * Get all socket paths including PID-based sockets in the directory
 * and legacy fallback paths
 */
export function getAllSocketPaths(): string[] {
  // Windows uses named pipes, not Unix sockets
  if (platform() === 'win32') {
    return [`\\\\.\\pipe\\${getSocketName()}`]
  }

  const paths: string[] = []
  const socketDir = getSocketDir()

  // Scan for *.sock files in the socket directory
  try {
    // eslint-disable-next-line custom-rules/no-sync-fs -- ClaudeForChromeContext.getSocketPaths (external @ant/claude-for-chrome-mcp) requires a sync () => string[] callback
    const files = readdirSync(socketDir)
    for (const file of files) {
      if (file.endsWith('.sock')) {
        paths.push(join(socketDir, file))
      }
    }
  } catch {
    // Directory may not exist yet
  }

  // Legacy fallback paths
  const legacyName = `claude-mcp-browser-bridge-${getUsername()}`
  const legacyTmpdir = join(tmpdir(), legacyName)
  const legacyTmp = `/tmp/${legacyName}`

  if (!paths.includes(legacyTmpdir)) {
    paths.push(legacyTmpdir)
  }
  if (legacyTmpdir !== legacyTmp && !paths.includes(legacyTmp)) {
    paths.push(legacyTmp)
  }

  return paths
}

function getSocketName(): string {
  // NOTE: This must match the one used in the Claude in Chrome MCP
  return `claude-mcp-browser-bridge-${getUsername()}`
}

function getUsername(): string {
  try {
    return userInfo().username || 'default'
  } catch {
    return process.env.USER || process.env.USERNAME || 'default'
  }
}
