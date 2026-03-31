/**
 * Protocol Handler
 *
 * Entry point for `claude --handle-uri <url>`. When the OS invokes claude
 * with a `claude-cli://` URL, this module:
 *   1. Parses the URI into a structured action
 *   2. Detects the user's terminal emulator
 *   3. Opens a new terminal window running claude with the appropriate args
 *
 * This runs in a headless context (no TTY) because the OS launches the binary
 * directly — there is no terminal attached.
 */

import { homedir } from 'os'
import { logForDebugging } from '../debug.js'
import {
  filterExistingPaths,
  getKnownPathsForRepo,
} from '../githubRepoPathMapping.js'
import { jsonStringify } from '../slowOperations.js'
import { readLastFetchTime } from './banner.js'
import { parseDeepLink } from './parseDeepLink.js'
import { MACOS_BUNDLE_ID } from './registerProtocol.js'
import { launchInTerminal } from './terminalLauncher.js'

/**
 * Handle an incoming deep link URI.
 *
 * Called from the CLI entry point when `--handle-uri` is passed.
 * This function parses the URI, resolves the claude binary, and
 * launches it in the user's terminal.
 *
 * @param uri - The raw URI string (e.g., "claude-cli://prompt?q=hello+world")
 * @returns exit code (0 = success)
 */
export async function handleDeepLinkUri(uri: string): Promise<number> {
  logForDebugging(`Handling deep link URI: ${uri}`)

  let action
  try {
    action = parseDeepLink(uri)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // biome-ignore lint/suspicious/noConsole: intentional error output
    console.error(`Deep link error: ${message}`)
    return 1
  }

  logForDebugging(`Parsed deep link action: ${jsonStringify(action)}`)

  // Always the running executable — no PATH lookup. The OS launched us via
  // an absolute path (bundle symlink / .desktop Exec= / registry command)
  // baked at registration time, and we want the terminal-launched Claude to
  // be the same binary. process.execPath is that binary.
  const { cwd, resolvedRepo } = await resolveCwd(action)
  // Resolve FETCH_HEAD age here, in the trampoline process, so main.tsx
  // stays await-free — the launched instance receives it as a precomputed
  // flag instead of statting the filesystem on its own startup path.
  const lastFetch = resolvedRepo ? await readLastFetchTime(cwd) : undefined
  const launched = await launchInTerminal(process.execPath, {
    query: action.query,
    cwd,
    repo: resolvedRepo,
    lastFetchMs: lastFetch?.getTime(),
  })
  if (!launched) {
    // biome-ignore lint/suspicious/noConsole: intentional error output
    console.error(
      'Failed to open a terminal. Make sure a supported terminal emulator is installed.',
    )
    return 1
  }

  return 0
}

/**
 * Handle the case where claude was launched as the app bundle's executable
 * by macOS (via URL scheme). Uses the NAPI module to receive the URL from
 * the Apple Event, then handles it normally.
 *
 * @returns exit code (0 = success, 1 = error, null = not a URL launch)
 */
export async function handleUrlSchemeLaunch(): Promise<number | null> {
  // LaunchServices overwrites __CFBundleIdentifier with the launching bundle's
  // ID. This is a precise positive signal — it's set to our exact bundle ID
  // if and only if macOS launched us via the URL handler .app bundle.
  // (`open` from a terminal passes the caller's env through, so negative
  // heuristics like !TERM don't work — the terminal's TERM leaks in.)
  if (process.env.__CFBundleIdentifier !== MACOS_BUNDLE_ID) {
    return null
  }

  try {
    const { waitForUrlEvent } = await import('url-handler-napi')
    const url = waitForUrlEvent(5000)
    if (!url) {
      return null
    }
    return await handleDeepLinkUri(url)
  } catch {
    // NAPI module not available, or handleDeepLinkUri rejected — not a URL launch
    return null
  }
}

/**
 * Resolve the working directory for the launched Claude instance.
 * Precedence: explicit cwd > repo lookup (MRU clone) > home.
 * A repo that isn't cloned locally is not an error — fall through to home
 * so a web link referencing a repo the user doesn't have still opens Claude.
 *
 * Returns the resolved cwd, and the repo slug if (and only if) the MRU
 * lookup hit — so the launched instance can show which clone was selected
 * and its git freshness.
 */
async function resolveCwd(action: {
  cwd?: string
  repo?: string
}): Promise<{ cwd: string; resolvedRepo?: string }> {
  if (action.cwd) {
    return { cwd: action.cwd }
  }
  if (action.repo) {
    const known = getKnownPathsForRepo(action.repo)
    const existing = await filterExistingPaths(known)
    if (existing[0]) {
      logForDebugging(`Resolved repo ${action.repo} → ${existing[0]}`)
      return { cwd: existing[0], resolvedRepo: action.repo }
    }
    logForDebugging(
      `No local clone found for repo ${action.repo}, falling back to home`,
    )
  }
  return { cwd: homedir() }
}
