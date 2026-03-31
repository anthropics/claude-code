import { homedir } from 'os'
import { getGlobalConfig, saveGlobalConfig } from '../../../utils/config.js'
import { logForDebugging } from '../../../utils/debug.js'
import {
  execFileNoThrow,
  execFileNoThrowWithCwd,
} from '../../../utils/execFileNoThrow.js'
import { logError } from '../../../utils/log.js'

/**
 * Package manager types for installing it2.
 * Listed in order of preference.
 */
export type PythonPackageManager = 'uvx' | 'pipx' | 'pip'

/**
 * Result of attempting to install it2.
 */
export type It2InstallResult = {
  success: boolean
  error?: string
  packageManager?: PythonPackageManager
}

/**
 * Result of verifying it2 setup.
 */
export type It2VerifyResult = {
  success: boolean
  error?: string
  needsPythonApiEnabled?: boolean
}

/**
 * Detects which Python package manager is available on the system.
 * Checks in order of preference: uvx, pipx, pip.
 *
 * @returns The detected package manager, or null if none found
 */
export async function detectPythonPackageManager(): Promise<PythonPackageManager | null> {
  // Check uv first (preferred for isolated environments)
  // We check for 'uv' since 'uv tool install' is the install command
  const uvResult = await execFileNoThrow('which', ['uv'])
  if (uvResult.code === 0) {
    logForDebugging('[it2Setup] Found uv (will use uv tool install)')
    return 'uvx' // Keep the type name for compatibility
  }

  // Check pipx (good for isolated environments)
  const pipxResult = await execFileNoThrow('which', ['pipx'])
  if (pipxResult.code === 0) {
    logForDebugging('[it2Setup] Found pipx package manager')
    return 'pipx'
  }

  // Check pip (fallback)
  const pipResult = await execFileNoThrow('which', ['pip'])
  if (pipResult.code === 0) {
    logForDebugging('[it2Setup] Found pip package manager')
    return 'pip'
  }

  // Also check pip3
  const pip3Result = await execFileNoThrow('which', ['pip3'])
  if (pip3Result.code === 0) {
    logForDebugging('[it2Setup] Found pip3 package manager')
    return 'pip'
  }

  logForDebugging('[it2Setup] No Python package manager found')
  return null
}

/**
 * Checks if the it2 CLI tool is installed and accessible.
 *
 * @returns true if it2 is available
 */
export async function isIt2CliAvailable(): Promise<boolean> {
  const result = await execFileNoThrow('which', ['it2'])
  return result.code === 0
}

/**
 * Installs the it2 CLI tool using the detected package manager.
 *
 * @param packageManager - The package manager to use for installation
 * @returns Result indicating success or failure
 */
export async function installIt2(
  packageManager: PythonPackageManager,
): Promise<It2InstallResult> {
  logForDebugging(`[it2Setup] Installing it2 using ${packageManager}`)

  // Run from home directory to avoid reading project-level pip.conf/uv.toml
  // which could be maliciously crafted to redirect to an attacker's PyPI server
  let result
  switch (packageManager) {
    case 'uvx':
      // uv tool install it2 installs it globally in isolated env
      // (uvx is for running, uv tool install is for installing)
      result = await execFileNoThrowWithCwd('uv', ['tool', 'install', 'it2'], {
        cwd: homedir(),
      })
      break
    case 'pipx':
      result = await execFileNoThrowWithCwd('pipx', ['install', 'it2'], {
        cwd: homedir(),
      })
      break
    case 'pip':
      // Use --user to install without sudo
      result = await execFileNoThrowWithCwd(
        'pip',
        ['install', '--user', 'it2'],
        { cwd: homedir() },
      )
      if (result.code !== 0) {
        // Try pip3 if pip fails
        result = await execFileNoThrowWithCwd(
          'pip3',
          ['install', '--user', 'it2'],
          { cwd: homedir() },
        )
      }
      break
  }

  if (result.code !== 0) {
    const error = result.stderr || 'Unknown installation error'
    logError(new Error(`[it2Setup] Failed to install it2: ${error}`))
    return {
      success: false,
      error,
      packageManager,
    }
  }

  logForDebugging('[it2Setup] it2 installed successfully')
  return {
    success: true,
    packageManager,
  }
}

/**
 * Verifies that it2 is properly configured and can communicate with iTerm2.
 * This tests the Python API connection by running a simple it2 command.
 *
 * @returns Result indicating success or the specific failure reason
 */
export async function verifyIt2Setup(): Promise<It2VerifyResult> {
  logForDebugging('[it2Setup] Verifying it2 setup...')

  // First check if it2 is installed
  const installed = await isIt2CliAvailable()
  if (!installed) {
    return {
      success: false,
      error: 'it2 CLI is not installed or not in PATH',
    }
  }

  // Try to list sessions - this tests the Python API connection
  const result = await execFileNoThrow('it2', ['session', 'list'])

  if (result.code !== 0) {
    const stderr = result.stderr.toLowerCase()

    // Check for common Python API errors
    if (
      stderr.includes('api') ||
      stderr.includes('python') ||
      stderr.includes('connection refused') ||
      stderr.includes('not enabled')
    ) {
      logForDebugging('[it2Setup] Python API not enabled in iTerm2')
      return {
        success: false,
        error: 'Python API not enabled in iTerm2 preferences',
        needsPythonApiEnabled: true,
      }
    }

    return {
      success: false,
      error: result.stderr || 'Failed to communicate with iTerm2',
    }
  }

  logForDebugging('[it2Setup] it2 setup verified successfully')
  return {
    success: true,
  }
}

/**
 * Returns instructions for enabling the Python API in iTerm2.
 */
export function getPythonApiInstructions(): string[] {
  return [
    'Almost done! Enable the Python API in iTerm2:',
    '',
    '  iTerm2 → Settings → General → Magic → Enable Python API',
    '',
    'After enabling, you may need to restart iTerm2.',
  ]
}

/**
 * Marks that it2 setup has been completed successfully.
 * This prevents showing the setup prompt again.
 */
export function markIt2SetupComplete(): void {
  const config = getGlobalConfig()
  if (config.iterm2It2SetupComplete !== true) {
    saveGlobalConfig(current => ({
      ...current,
      iterm2It2SetupComplete: true,
    }))
    logForDebugging('[it2Setup] Marked it2 setup as complete')
  }
}

/**
 * Marks that the user prefers to use tmux over iTerm2 split panes.
 * This prevents showing the setup prompt when in iTerm2.
 */
export function setPreferTmuxOverIterm2(prefer: boolean): void {
  const config = getGlobalConfig()
  if (config.preferTmuxOverIterm2 !== prefer) {
    saveGlobalConfig(current => ({
      ...current,
      preferTmuxOverIterm2: prefer,
    }))
    logForDebugging(`[it2Setup] Set preferTmuxOverIterm2 = ${prefer}`)
  }
}

/**
 * Checks if the user prefers tmux over iTerm2 split panes.
 */
export function getPreferTmuxOverIterm2(): boolean {
  return getGlobalConfig().preferTmuxOverIterm2 === true
}
