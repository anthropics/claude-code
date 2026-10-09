/**
 * Protocol Handler Registration
 *
 * Registers the `claude-cli://` custom URI scheme with the OS,
 * so that clicking a `claude-cli://` link in a browser (or any app) will
 * invoke `claude --handle-uri <url>`.
 *
 * Platform details:
 *   macOS  — Creates a minimal .app trampoline in ~/Applications with
 *            CFBundleURLTypes in its Info.plist
 *   Linux  — Creates a .desktop file in $XDG_DATA_HOME/applications
 *            (default ~/.local/share/applications) and registers it with xdg-mime
 *   Windows — Writes registry keys under HKEY_CURRENT_USER\Software\Classes
 */

import { promises as fs } from 'fs'
import * as os from 'os'
import * as path from 'path'
import { getFeatureValue_CACHED_MAY_BE_STALE } from 'src/services/analytics/growthbook.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from 'src/services/analytics/index.js'
import { logForDebugging } from '../debug.js'
import { getClaudeConfigHomeDir } from '../envUtils.js'
import { getErrnoCode } from '../errors.js'
import { execFileNoThrow } from '../execFileNoThrow.js'
import { getInitialSettings } from '../settings/settings.js'
import { which } from '../which.js'
import { getUserBinDir, getXDGDataHome } from '../xdg.js'
import { DEEP_LINK_PROTOCOL } from './parseDeepLink.js'

export const MACOS_BUNDLE_ID = 'com.anthropic.claude-code-url-handler'
const APP_NAME = 'Claude Code URL Handler'
const DESKTOP_FILE_NAME = 'claude-code-url-handler.desktop'
const MACOS_APP_NAME = 'Claude Code URL Handler.app'

// Shared between register* (writes these paths/values) and
// isProtocolHandlerCurrent (reads them back). Keep the writer and reader
// in lockstep — drift here means the check returns a perpetual false.
const MACOS_APP_DIR = path.join(os.homedir(), 'Applications', MACOS_APP_NAME)
const MACOS_SYMLINK_PATH = path.join(
  MACOS_APP_DIR,
  'Contents',
  'MacOS',
  'claude',
)
function linuxDesktopPath(): string {
  return path.join(getXDGDataHome(), 'applications', DESKTOP_FILE_NAME)
}
const WINDOWS_REG_KEY = `HKEY_CURRENT_USER\\Software\\Classes\\${DEEP_LINK_PROTOCOL}`
const WINDOWS_COMMAND_KEY = `${WINDOWS_REG_KEY}\\shell\\open\\command`

const FAILURE_BACKOFF_MS = 24 * 60 * 60 * 1000

function linuxExecLine(claudePath: string): string {
  return `Exec="${claudePath}" --handle-uri %u`
}
function windowsCommandValue(claudePath: string): string {
  return `"${claudePath}" --handle-uri "%1"`
}

/**
 * Register the protocol handler on macOS.
 *
 * Creates a .app bundle where the CFBundleExecutable is a symlink to the
 * already-installed (and signed) `claude` binary. When macOS opens a
 * `claude-cli://` URL, it launches `claude` through this app bundle.
 * Claude then uses the url-handler NAPI module to read the URL from the
 * Apple Event and handles it normally.
 *
 * This approach avoids shipping a separate executable (which would need
 * to be signed and allowlisted by endpoint security tools like Santa).
 */
async function registerMacos(claudePath: string): Promise<void> {
  const contentsDir = path.join(MACOS_APP_DIR, 'Contents')

  // Remove any existing app bundle to start clean
  try {
    await fs.rm(MACOS_APP_DIR, { recursive: true })
  } catch (e: unknown) {
    const code = getErrnoCode(e)
    if (code !== 'ENOENT') {
      throw e
    }
  }

  await fs.mkdir(path.dirname(MACOS_SYMLINK_PATH), { recursive: true })

  // Info.plist — registers the URL scheme with claude as the executable
  const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key>
  <string>${MACOS_BUNDLE_ID}</string>
  <key>CFBundleName</key>
  <string>${APP_NAME}</string>
  <key>CFBundleExecutable</key>
  <string>claude</string>
  <key>CFBundleVersion</key>
  <string>1.0</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>LSBackgroundOnly</key>
  <true/>
  <key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleURLName</key>
      <string>Claude Code Deep Link</string>
      <key>CFBundleURLSchemes</key>
      <array>
        <string>${DEEP_LINK_PROTOCOL}</string>
      </array>
    </dict>
  </array>
</dict>
</plist>`

  await fs.writeFile(path.join(contentsDir, 'Info.plist'), infoPlist)

  // Symlink to the already-signed claude binary — avoids a new executable
  // that would need signing and endpoint-security allowlisting.
  // Written LAST among the throwing fs calls: isProtocolHandlerCurrent reads
  // this symlink, so it acts as the commit marker. If Info.plist write
  // failed above, no symlink → next session retries.
  await fs.symlink(claudePath, MACOS_SYMLINK_PATH)

  // Re-register the app with LaunchServices so macOS picks up the URL scheme.
  const lsregister =
    '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'
  await execFileNoThrow(lsregister, ['-R', MACOS_APP_DIR], { useCwd: false })

  logForDebugging(
    `Registered ${DEEP_LINK_PROTOCOL}:// protocol handler at ${MACOS_APP_DIR}`,
  )
}

/**
 * Register the protocol handler on Linux.
 * Creates a .desktop file and registers it with xdg-mime.
 */
async function registerLinux(claudePath: string): Promise<void> {
  await fs.mkdir(path.dirname(linuxDesktopPath()), { recursive: true })

  const desktopEntry = `[Desktop Entry]
Name=${APP_NAME}
Comment=Handle ${DEEP_LINK_PROTOCOL}:// deep links for Claude Code
${linuxExecLine(claudePath)}
Type=Application
NoDisplay=true
MimeType=x-scheme-handler/${DEEP_LINK_PROTOCOL};
`

  await fs.writeFile(linuxDesktopPath(), desktopEntry)

  // Register as the default handler for the scheme. On headless boxes
  // (WSL, Docker, CI) xdg-utils isn't installed — not a failure: there's
  // no desktop to click links from, and some apps read the .desktop
  // MimeType line directly. The artifact check still short-circuits
  // next session since the .desktop file is present.
  const xdgMime = await which('xdg-mime')
  if (xdgMime) {
    const { code } = await execFileNoThrow(
      xdgMime,
      ['default', DESKTOP_FILE_NAME, `x-scheme-handler/${DEEP_LINK_PROTOCOL}`],
      { useCwd: false },
    )
    if (code !== 0) {
      throw Object.assign(new Error(`xdg-mime exited with code ${code}`), {
        code: 'XDG_MIME_FAILED',
      })
    }
  }

  logForDebugging(
    `Registered ${DEEP_LINK_PROTOCOL}:// protocol handler at ${linuxDesktopPath()}`,
  )
}

/**
 * Register the protocol handler on Windows via the registry.
 */
async function registerWindows(claudePath: string): Promise<void> {
  for (const args of [
    ['add', WINDOWS_REG_KEY, '/ve', '/d', `URL:${APP_NAME}`, '/f'],
    ['add', WINDOWS_REG_KEY, '/v', 'URL Protocol', '/d', '', '/f'],
    [
      'add',
      WINDOWS_COMMAND_KEY,
      '/ve',
      '/d',
      windowsCommandValue(claudePath),
      '/f',
    ],
  ]) {
    const { code } = await execFileNoThrow('reg', args, { useCwd: false })
    if (code !== 0) {
      throw Object.assign(new Error(`reg add exited with code ${code}`), {
        code: 'REG_FAILED',
      })
    }
  }

  logForDebugging(
    `Registered ${DEEP_LINK_PROTOCOL}:// protocol handler in Windows registry`,
  )
}

/**
 * Register the `claude-cli://` protocol handler with the operating system.
 * After registration, clicking a `claude-cli://` link will invoke claude.
 */
export async function registerProtocolHandler(
  claudePath?: string,
): Promise<void> {
  const resolved = claudePath ?? (await resolveClaudePath())

  switch (process.platform) {
    case 'darwin':
      await registerMacos(resolved)
      break
    case 'linux':
      await registerLinux(resolved)
      break
    case 'win32':
      await registerWindows(resolved)
      break
    default:
      throw new Error(`Unsupported platform: ${process.platform}`)
  }
}

/**
 * Resolve the claude binary path for protocol registration. Prefers the
 * native installer's stable symlink (~/.local/bin/claude) which survives
 * auto-updates; falls back to process.execPath when the symlink is absent
 * (dev builds, non-native installs).
 */
async function resolveClaudePath(): Promise<string> {
  const binaryName = process.platform === 'win32' ? 'claude.exe' : 'claude'
  const stablePath = path.join(getUserBinDir(), binaryName)
  try {
    await fs.realpath(stablePath)
    return stablePath
  } catch {
    return process.execPath
  }
}

/**
 * Check whether the OS-level protocol handler is already registered AND
 * points at the expected `claude` binary. Reads the registration artifact
 * directly (symlink target, .desktop Exec line, registry value) rather than
 * a cached flag in ~/.claude.json, so:
 *   - the check is per-machine (config can sync across machines; OS state can't)
 *   - stale paths self-heal (install-method change → re-register next session)
 *   - deleted artifacts self-heal
 *
 * Any read error (ENOENT, EACCES, reg nonzero) → false → re-register.
 */
export async function isProtocolHandlerCurrent(
  claudePath: string,
): Promise<boolean> {
  try {
    switch (process.platform) {
      case 'darwin': {
        const target = await fs.readlink(MACOS_SYMLINK_PATH)
        return target === claudePath
      }
      case 'linux': {
        const content = await fs.readFile(linuxDesktopPath(), 'utf8')
        return content.includes(linuxExecLine(claudePath))
      }
      case 'win32': {
        const { stdout, code } = await execFileNoThrow(
          'reg',
          ['query', WINDOWS_COMMAND_KEY, '/ve'],
          { useCwd: false },
        )
        return code === 0 && stdout.includes(windowsCommandValue(claudePath))
      }
      default:
        return false
    }
  } catch {
    return false
  }
}

/**
 * Auto-register the claude-cli:// deep link protocol handler when missing
 * or stale. Runs every session from backgroundHousekeeping (fire-and-forget),
 * but the artifact check makes it a no-op after the first successful run
 * unless the install path moves or the OS artifact is deleted.
 */
export async function ensureDeepLinkProtocolRegistered(): Promise<void> {
  if (getInitialSettings().disableDeepLinkRegistration === 'disable') {
    return
  }
  if (!getFeatureValue_CACHED_MAY_BE_STALE('tengu_lodestone_enabled', false)) {
    return
  }

  const claudePath = await resolveClaudePath()
  if (await isProtocolHandlerCurrent(claudePath)) {
    return
  }

  // EACCES/ENOSPC are deterministic — retrying next session won't help.
  // Throttle to once per 24h so a read-only ~/.local/share/applications
  // doesn't generate a failure event on every startup. Marker lives in
  // ~/.claude (per-machine, not synced) rather than ~/.claude.json (can sync).
  const failureMarkerPath = path.join(
    getClaudeConfigHomeDir(),
    '.deep-link-register-failed',
  )
  try {
    const stat = await fs.stat(failureMarkerPath)
    if (Date.now() - stat.mtimeMs < FAILURE_BACKOFF_MS) {
      return
    }
  } catch {
    // Marker absent — proceed.
  }

  try {
    await registerProtocolHandler(claudePath)
    logEvent('tengu_deep_link_registered', { success: true })
    logForDebugging('Auto-registered claude-cli:// deep link protocol handler')
    await fs.rm(failureMarkerPath, { force: true }).catch(() => {})
  } catch (error) {
    const code = getErrnoCode(error)
    logEvent('tengu_deep_link_registered', {
      success: false,
      error_code:
        code as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
    logForDebugging(
      `Failed to auto-register deep link protocol handler: ${error instanceof Error ? error.message : String(error)}`,
      { level: 'warn' },
    )
    if (code === 'EACCES' || code === 'ENOSPC') {
      await fs.writeFile(failureMarkerPath, '').catch(() => {})
    }
  }
}
