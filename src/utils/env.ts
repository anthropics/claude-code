import memoize from 'lodash-es/memoize.js'
import { homedir } from 'os'
import { join } from 'path'
import { fileSuffixForOauthConfig } from '../constants/oauth.js'
import { isRunningWithBun } from './bundledMode.js'
import { getClaudeConfigHomeDir, isEnvTruthy } from './envUtils.js'
import { findExecutable } from './findExecutable.js'
import { getFsImplementation } from './fsOperations.js'
import { which } from './which.js'

type Platform = 'win32' | 'darwin' | 'linux'

// Config and data paths
export const getGlobalClaudeFile = memoize((): string => {
  // Legacy fallback for backwards compatibility
  if (
    getFsImplementation().existsSync(
      join(getClaudeConfigHomeDir(), '.config.json'),
    )
  ) {
    return join(getClaudeConfigHomeDir(), '.config.json')
  }

  const filename = `.claude${fileSuffixForOauthConfig()}.json`
  return join(process.env.CLAUDE_CONFIG_DIR || homedir(), filename)
})

const hasInternetAccess = memoize(async (): Promise<boolean> => {
  try {
    const { default: axiosClient } = await import('axios')
    await axiosClient.head('http://1.1.1.1', {
      signal: AbortSignal.timeout(1000),
    })
    return true
  } catch {
    return false
  }
})

async function isCommandAvailable(command: string): Promise<boolean> {
  try {
    // which does not execute the file.
    return !!(await which(command))
  } catch {
    return false
  }
}

const detectPackageManagers = memoize(async (): Promise<string[]> => {
  const packageManagers = []

  if (await isCommandAvailable('npm')) packageManagers.push('npm')
  if (await isCommandAvailable('yarn')) packageManagers.push('yarn')
  if (await isCommandAvailable('pnpm')) packageManagers.push('pnpm')

  return packageManagers
})

const detectRuntimes = memoize(async (): Promise<string[]> => {
  const runtimes = []

  if (await isCommandAvailable('bun')) runtimes.push('bun')
  if (await isCommandAvailable('deno')) runtimes.push('deno')
  if (await isCommandAvailable('node')) runtimes.push('node')

  return runtimes
})

/**
 * Checks if we're running in a WSL environment
 * @returns true if running in WSL, false otherwise
 */
const isWslEnvironment = memoize((): boolean => {
  try {
    // Check for WSLInterop file which is a reliable indicator of WSL
    return getFsImplementation().existsSync(
      '/proc/sys/fs/binfmt_misc/WSLInterop',
    )
  } catch (_error) {
    // If there's an error checking, assume not WSL
    return false
  }
})

/**
 * Checks if the npm executable is located in the Windows filesystem within WSL
 * @returns true if npm is from Windows (starts with /mnt/c/), false otherwise
 */
const isNpmFromWindowsPath = memoize((): boolean => {
  try {
    // Only relevant in WSL environment
    if (!isWslEnvironment()) {
      return false
    }

    // Find the actual npm executable path
    const { cmd } = findExecutable('npm', [])

    // If npm is in Windows path, it will start with /mnt/c/
    return cmd.startsWith('/mnt/c/')
  } catch (_error) {
    // If there's an error, assume it's not from Windows
    return false
  }
})

/**
 * Checks if we're running via Conductor
 * @returns true if running via Conductor, false otherwise
 */
function isConductor(): boolean {
  return process.env.__CFBundleIdentifier === 'com.conductor.app'
}

export const JETBRAINS_IDES = [
  'pycharm',
  'intellij',
  'webstorm',
  'phpstorm',
  'rubymine',
  'clion',
  'goland',
  'rider',
  'datagrip',
  'appcode',
  'dataspell',
  'aqua',
  'gateway',
  'fleet',
  'jetbrains',
  'androidstudio',
]

// Detect terminal type with fallbacks for all platforms
function detectTerminal(): string | null {
  if (process.env.CURSOR_TRACE_ID) return 'cursor'
  // Cursor and Windsurf under WSL have TERM_PROGRAM=vscode
  if (process.env.VSCODE_GIT_ASKPASS_MAIN?.includes('cursor')) {
    return 'cursor'
  }
  if (process.env.VSCODE_GIT_ASKPASS_MAIN?.includes('windsurf')) {
    return 'windsurf'
  }
  if (process.env.VSCODE_GIT_ASKPASS_MAIN?.includes('antigravity')) {
    return 'antigravity'
  }
  const bundleId = process.env.__CFBundleIdentifier?.toLowerCase()
  if (bundleId?.includes('vscodium')) return 'codium'
  if (bundleId?.includes('windsurf')) return 'windsurf'
  if (bundleId?.includes('com.google.android.studio')) return 'androidstudio'
  // Check for JetBrains IDEs in bundle ID
  if (bundleId) {
    for (const ide of JETBRAINS_IDES) {
      if (bundleId.includes(ide)) return ide
    }
  }

  if (process.env.VisualStudioVersion) {
    // This is desktop Visual Studio, not VS Code
    return 'visualstudio'
  }

  // Check for JetBrains terminal on Linux/Windows
  if (process.env.TERMINAL_EMULATOR === 'JetBrains-JediTerm') {
    // For macOS, bundle ID detection above already handles JetBrains IDEs
    if (process.platform === 'darwin') return 'pycharm'

    // For finegrained detection on Linux/Windows use envDynamic.getTerminalWithJetBrainsDetection()
    return 'pycharm'
  }

  // Check for specific terminals by TERM before TERM_PROGRAM
  // This handles cases where TERM and TERM_PROGRAM might be inconsistent
  if (process.env.TERM === 'xterm-ghostty') {
    return 'ghostty'
  }
  if (process.env.TERM?.includes('kitty')) {
    return 'kitty'
  }

  if (process.env.TERM_PROGRAM) {
    return process.env.TERM_PROGRAM
  }

  if (process.env.TMUX) return 'tmux'
  if (process.env.STY) return 'screen'

  // Check for terminal-specific environment variables (common on Linux)
  if (process.env.KONSOLE_VERSION) return 'konsole'
  if (process.env.GNOME_TERMINAL_SERVICE) return 'gnome-terminal'
  if (process.env.XTERM_VERSION) return 'xterm'
  if (process.env.VTE_VERSION) return 'vte-based'
  if (process.env.TERMINATOR_UUID) return 'terminator'
  if (process.env.KITTY_WINDOW_ID) {
    return 'kitty'
  }
  if (process.env.ALACRITTY_LOG) return 'alacritty'
  if (process.env.TILIX_ID) return 'tilix'

  // Windows-specific detection
  if (process.env.WT_SESSION) return 'windows-terminal'
  if (process.env.SESSIONNAME && process.env.TERM === 'cygwin') return 'cygwin'
  if (process.env.MSYSTEM) return process.env.MSYSTEM.toLowerCase() // MINGW64, MSYS2, etc.
  if (
    process.env.ConEmuANSI ||
    process.env.ConEmuPID ||
    process.env.ConEmuTask
  ) {
    return 'conemu'
  }

  // WSL detection
  if (process.env.WSL_DISTRO_NAME) return `wsl-${process.env.WSL_DISTRO_NAME}`

  // SSH session detection
  if (isSSHSession()) {
    return 'ssh-session'
  }

  // Fall back to TERM which is more universally available
  // Special case for common terminal identifiers in TERM
  if (process.env.TERM) {
    const term = process.env.TERM
    if (term.includes('alacritty')) return 'alacritty'
    if (term.includes('rxvt')) return 'rxvt'
    if (term.includes('termite')) return 'termite'
    return process.env.TERM
  }

  // Detect non-interactive environment
  if (!process.stdout.isTTY) return 'non-interactive'

  return null
}

/**
 * Detects the deployment environment/platform based on environment variables
 * @returns The deployment platform name, or 'unknown' if not detected
 */
export const detectDeploymentEnvironment = memoize((): string => {
  // Cloud development environments
  if (isEnvTruthy(process.env.CODESPACES)) return 'codespaces'
  if (process.env.GITPOD_WORKSPACE_ID) return 'gitpod'
  if (process.env.REPL_ID || process.env.REPL_SLUG) return 'replit'
  if (process.env.PROJECT_DOMAIN) return 'glitch'

  // Cloud platforms
  if (isEnvTruthy(process.env.VERCEL)) return 'vercel'
  if (
    process.env.RAILWAY_ENVIRONMENT_NAME ||
    process.env.RAILWAY_SERVICE_NAME
  ) {
    return 'railway'
  }
  if (isEnvTruthy(process.env.RENDER)) return 'render'
  if (isEnvTruthy(process.env.NETLIFY)) return 'netlify'
  if (process.env.DYNO) return 'heroku'
  if (process.env.FLY_APP_NAME || process.env.FLY_MACHINE_ID) return 'fly.io'
  if (isEnvTruthy(process.env.CF_PAGES)) return 'cloudflare-pages'
  if (process.env.DENO_DEPLOYMENT_ID) return 'deno-deploy'
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) return 'aws-lambda'
  if (process.env.AWS_EXECUTION_ENV === 'AWS_ECS_FARGATE') return 'aws-fargate'
  if (process.env.AWS_EXECUTION_ENV === 'AWS_ECS_EC2') return 'aws-ecs'
  // Check for EC2 via hypervisor UUID
  try {
    const uuid = getFsImplementation()
      .readFileSync('/sys/hypervisor/uuid', { encoding: 'utf8' })
      .trim()
      .toLowerCase()
    if (uuid.startsWith('ec2')) return 'aws-ec2'
  } catch {
    // Ignore errors reading hypervisor UUID (ENOENT on non-EC2, etc.)
  }
  if (process.env.K_SERVICE) return 'gcp-cloud-run'
  if (process.env.GOOGLE_CLOUD_PROJECT) return 'gcp'
  if (process.env.WEBSITE_SITE_NAME || process.env.WEBSITE_SKU)
    return 'azure-app-service'
  if (process.env.AZURE_FUNCTIONS_ENVIRONMENT) return 'azure-functions'
  if (process.env.APP_URL?.includes('ondigitalocean.app')) {
    return 'digitalocean-app-platform'
  }
  if (process.env.SPACE_CREATOR_USER_ID) return 'huggingface-spaces'

  // CI/CD platforms
  if (isEnvTruthy(process.env.GITHUB_ACTIONS)) return 'github-actions'
  if (isEnvTruthy(process.env.GITLAB_CI)) return 'gitlab-ci'
  if (process.env.CIRCLECI) return 'circleci'
  if (process.env.BUILDKITE) return 'buildkite'
  if (isEnvTruthy(process.env.CI)) return 'ci'

  // Container orchestration
  if (process.env.KUBERNETES_SERVICE_HOST) return 'kubernetes'
  try {
    if (getFsImplementation().existsSync('/.dockerenv')) return 'docker'
  } catch {
    // Ignore errors checking for Docker
  }

  // Platform-specific fallback for undetected environments
  if (env.platform === 'darwin') return 'unknown-darwin'
  if (env.platform === 'linux') return 'unknown-linux'
  if (env.platform === 'win32') return 'unknown-win32'

  return 'unknown'
})

// all of these should be immutable
function isSSHSession(): boolean {
  return !!(
    process.env.SSH_CONNECTION ||
    process.env.SSH_CLIENT ||
    process.env.SSH_TTY
  )
}

export const env = {
  hasInternetAccess,
  isCI: isEnvTruthy(process.env.CI),
  platform: (['win32', 'darwin'].includes(process.platform)
    ? process.platform
    : 'linux') as Platform,
  arch: process.arch,
  nodeVersion: process.version,
  terminal: detectTerminal(),
  isSSH: isSSHSession,
  getPackageManagers: detectPackageManagers,
  getRuntimes: detectRuntimes,
  isRunningWithBun: memoize(isRunningWithBun),
  isWslEnvironment,
  isNpmFromWindowsPath,
  isConductor,
  detectDeploymentEnvironment,
}

/**
 * Returns the host platform for analytics reporting.
 * If CLAUDE_CODE_HOST_PLATFORM is set to a valid platform value, that overrides
 * the detected platform. This is useful for container/remote environments where
 * process.platform reports the container OS but the actual host platform differs.
 */
export function getHostPlatformForAnalytics(): Platform {
  const override = process.env.CLAUDE_CODE_HOST_PLATFORM
  if (override === 'win32' || override === 'darwin' || override === 'linux') {
    return override
  }
  return env.platform
}
