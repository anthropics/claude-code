import { feature } from 'bun:bundle'
import { stat } from 'fs/promises'
import memoize from 'lodash-es/memoize.js'
import { env, JETBRAINS_IDES } from './env.js'
import { isEnvTruthy } from './envUtils.js'
import { execFileNoThrow } from './execFileNoThrow.js'
import { getAncestorCommandsAsync } from './genericProcessUtils.js'

// Functions that require execFileNoThrow and thus cannot be in env.ts

const getIsDocker = memoize(async (): Promise<boolean> => {
  if (process.platform !== 'linux') return false
  // Check for .dockerenv file
  const { code } = await execFileNoThrow('test', ['-f', '/.dockerenv'])
  return code === 0
})

function getIsBubblewrapSandbox(): boolean {
  return (
    process.platform === 'linux' &&
    isEnvTruthy(process.env.CLAUDE_CODE_BUBBLEWRAP)
  )
}

// Cache for the runtime musl detection fallback (node/unbundled only).
// In native linux builds, feature flags resolve this at compile time, so the
// cache is only consulted when both IS_LIBC_MUSL and IS_LIBC_GLIBC are false.
let muslRuntimeCache: boolean | null = null

// Fire-and-forget: populate the musl cache for the node fallback path.
// Native builds never reach this (feature flags short-circuit), so this only
// matters for unbundled node on Linux. Installer calls on native builds are
// unaffected since feature() resolves at compile time.
if (process.platform === 'linux') {
  const muslArch = process.arch === 'x64' ? 'x86_64' : 'aarch64'
  void stat(`/lib/libc.musl-${muslArch}.so.1`).then(
    () => {
      muslRuntimeCache = true
    },
    () => {
      muslRuntimeCache = false
    },
  )
}

/**
 * Checks if the system is using MUSL libc instead of glibc.
 * In native linux builds, this is statically known at compile time via IS_LIBC_MUSL/IS_LIBC_GLIBC flags.
 * In node (unbundled), both flags are false and we fall back to a runtime async stat check
 * whose result is cached at module load. If the cache isn't populated yet, returns false.
 */
function isMuslEnvironment(): boolean {
  if (feature('IS_LIBC_MUSL')) return true
  if (feature('IS_LIBC_GLIBC')) return false

  // Fallback for node: runtime detection via pre-populated cache
  if (process.platform !== 'linux') return false
  return muslRuntimeCache ?? false
}

// Cache for async JetBrains detection
let jetBrainsIDECache: string | null | undefined

async function detectJetBrainsIDEFromParentProcessAsync(): Promise<
  string | null
> {
  if (jetBrainsIDECache !== undefined) {
    return jetBrainsIDECache
  }

  if (process.platform === 'darwin') {
    jetBrainsIDECache = null
    return null // macOS uses bundle ID detection which is already handled
  }

  try {
    // Get ancestor commands in a single call (avoids sync bash in loop)
    const commands = await getAncestorCommandsAsync(process.pid, 10)

    for (const command of commands) {
      const lowerCommand = command.toLowerCase()
      // Check for specific JetBrains IDEs in the command line
      for (const ide of JETBRAINS_IDES) {
        if (lowerCommand.includes(ide)) {
          jetBrainsIDECache = ide
          return ide
        }
      }
    }
  } catch {
    // Silently fail - this is a best-effort detection
  }

  jetBrainsIDECache = null
  return null
}

export async function getTerminalWithJetBrainsDetectionAsync(): Promise<
  string | null
> {
  // Check for JetBrains terminal on Linux/Windows
  if (process.env.TERMINAL_EMULATOR === 'JetBrains-JediTerm') {
    // For macOS, bundle ID detection above already handles JetBrains IDEs
    if (env.platform !== 'darwin') {
      const specificIDE = await detectJetBrainsIDEFromParentProcessAsync()
      return specificIDE || 'pycharm'
    }
  }
  return env.terminal
}

// Synchronous version that returns cached result or falls back to env.terminal
// Used for backward compatibility - callers should migrate to async version
export function getTerminalWithJetBrainsDetection(): string | null {
  // Check for JetBrains terminal on Linux/Windows
  if (process.env.TERMINAL_EMULATOR === 'JetBrains-JediTerm') {
    // For macOS, bundle ID detection above already handles JetBrains IDEs
    if (env.platform !== 'darwin') {
      // Return cached value if available, otherwise fall back to generic detection
      // The async version should be called early in app initialization to populate cache
      if (jetBrainsIDECache !== undefined) {
        return jetBrainsIDECache || 'pycharm'
      }
      // Fall back to generic 'pycharm' if cache not populated yet
      return 'pycharm'
    }
  }
  return env.terminal
}

/**
 * Initialize JetBrains IDE detection asynchronously.
 * Call this early in app initialization to populate the cache.
 * After this resolves, getTerminalWithJetBrainsDetection() will return accurate results.
 */
export async function initJetBrainsDetection(): Promise<void> {
  if (process.env.TERMINAL_EMULATOR === 'JetBrains-JediTerm') {
    await detectJetBrainsIDEFromParentProcessAsync()
  }
}

// Combined export that includes all env properties plus dynamic functions
export const envDynamic = {
  ...env, // Include all properties from env
  terminal: getTerminalWithJetBrainsDetection(),
  getIsDocker,
  getIsBubblewrapSandbox,
  isMuslEnvironment,
  getTerminalWithJetBrainsDetectionAsync,
  initJetBrainsDetection,
}
