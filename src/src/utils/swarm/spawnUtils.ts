/**
 * Shared utilities for spawning teammates across different backends.
 */

import {
  getChromeFlagOverride,
  getFlagSettingsPath,
  getInlinePlugins,
  getMainLoopModelOverride,
  getSessionBypassPermissionsMode,
} from '../../bootstrap/state.js'
import { quote } from '../bash/shellQuote.js'
import { isInBundledMode } from '../bundledMode.js'
import type { PermissionMode } from '../permissions/PermissionMode.js'
import { getTeammateModeFromSnapshot } from './backends/teammateModeSnapshot.js'
import { TEAMMATE_COMMAND_ENV_VAR } from './constants.js'

/**
 * Gets the command to use for spawning teammate processes.
 * Uses TEAMMATE_COMMAND_ENV_VAR if set, otherwise falls back to the
 * current process executable path.
 */
export function getTeammateCommand(): string {
  if (process.env[TEAMMATE_COMMAND_ENV_VAR]) {
    return process.env[TEAMMATE_COMMAND_ENV_VAR]
  }
  return isInBundledMode() ? process.execPath : process.argv[1]!
}

/**
 * Builds CLI flags to propagate from the current session to spawned teammates.
 * This ensures teammates inherit important settings like permission mode,
 * model selection, and plugin configuration from their parent.
 *
 * @param options.planModeRequired - If true, don't inherit bypass permissions (plan mode takes precedence)
 * @param options.permissionMode - Permission mode to propagate
 */
export function buildInheritedCliFlags(options?: {
  planModeRequired?: boolean
  permissionMode?: PermissionMode
}): string {
  const flags: string[] = []
  const { planModeRequired, permissionMode } = options || {}

  // Propagate permission mode to teammates, but NOT if plan mode is required
  // Plan mode takes precedence over bypass permissions for safety
  if (planModeRequired) {
    // Don't inherit bypass permissions when plan mode is required
  } else if (
    permissionMode === 'bypassPermissions' ||
    getSessionBypassPermissionsMode()
  ) {
    flags.push('--dangerously-skip-permissions')
  } else if (permissionMode === 'acceptEdits') {
    flags.push('--permission-mode acceptEdits')
  }

  // Propagate --model if explicitly set via CLI
  const modelOverride = getMainLoopModelOverride()
  if (modelOverride) {
    flags.push(`--model ${quote([modelOverride])}`)
  }

  // Propagate --settings if set via CLI
  const settingsPath = getFlagSettingsPath()
  if (settingsPath) {
    flags.push(`--settings ${quote([settingsPath])}`)
  }

  // Propagate --plugin-dir for each inline plugin
  const inlinePlugins = getInlinePlugins()
  for (const pluginDir of inlinePlugins) {
    flags.push(`--plugin-dir ${quote([pluginDir])}`)
  }

  // Propagate --teammate-mode so tmux teammates use the same mode as leader
  const sessionMode = getTeammateModeFromSnapshot()
  flags.push(`--teammate-mode ${sessionMode}`)

  // Propagate --chrome / --no-chrome if explicitly set on the CLI
  const chromeFlagOverride = getChromeFlagOverride()
  if (chromeFlagOverride === true) {
    flags.push('--chrome')
  } else if (chromeFlagOverride === false) {
    flags.push('--no-chrome')
  }

  return flags.join(' ')
}

/**
 * Environment variables that must be explicitly forwarded to tmux-spawned
 * teammates. Tmux may start a new login shell that doesn't inherit the
 * parent's env, so we forward any that are set in the current process.
 */
const TEAMMATE_ENV_VARS = [
  // API provider selection — without these, teammates default to firstParty
  // and send requests to the wrong endpoint (GitHub issue #23561)
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'CLAUDE_CODE_USE_FOUNDRY',
  // Custom API endpoint
  'ANTHROPIC_BASE_URL',
  // Config directory override
  'CLAUDE_CONFIG_DIR',
  // CCR marker — teammates need this for CCR-aware code paths. Auth finds
  // its own way via /home/claude/.claude/remote/.oauth_token regardless;
  // the FD env var wouldn't help (pipe FDs don't cross tmux).
  'CLAUDE_CODE_REMOTE',
  // Auto-memory gate (memdir/paths.ts) checks REMOTE && !MEMORY_DIR to
  // disable memory on ephemeral CCR filesystems. Forwarding REMOTE alone
  // would flip teammates to memory-off when the parent has it on.
  'CLAUDE_CODE_REMOTE_MEMORY_DIR',
  // Upstream proxy — the parent's MITM relay is reachable from teammates
  // (same container network). Forward the proxy vars so teammates route
  // customer-configured upstream traffic through the relay for credential
  // injection. Without these, teammates bypass the proxy entirely.
  'HTTPS_PROXY',
  'https_proxy',
  'HTTP_PROXY',
  'http_proxy',
  'NO_PROXY',
  'no_proxy',
  'SSL_CERT_FILE',
  'NODE_EXTRA_CA_CERTS',
  'REQUESTS_CA_BUNDLE',
  'CURL_CA_BUNDLE',
] as const

/**
 * Builds the `env KEY=VALUE ...` string for teammate spawn commands.
 * Always includes CLAUDECODE=1 and CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1,
 * plus any provider/config env vars that are set in the current process.
 */
export function buildInheritedEnvVars(): string {
  const envVars = ['CLAUDECODE=1', 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1']

  for (const key of TEAMMATE_ENV_VARS) {
    const value = process.env[key]
    if (value !== undefined && value !== '') {
      envVars.push(`${key}=${quote([value])}`)
    }
  }

  return envVars.join(' ')
}
