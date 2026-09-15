import chalk from 'chalk'
import { exec } from 'child_process'
import { execa } from 'execa'
import { mkdir, stat } from 'fs/promises'
import memoize from 'lodash-es/memoize.js'
import { join } from 'path'
import { CLAUDE_AI_PROFILE_SCOPE } from 'src/constants/oauth.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from 'src/services/analytics/index.js'
import { getModelStrings } from 'src/utils/model/modelStrings.js'
import { getAPIProvider } from 'src/utils/model/providers.js'
import {
  getIsNonInteractiveSession,
  preferThirdPartyAuthentication,
} from '../bootstrap/state.js'
import {
  getMockSubscriptionType,
  shouldUseMockSubscription,
} from '../services/mockRateLimits.js'
import {
  isOAuthTokenExpired,
  refreshOAuthToken,
  shouldUseClaudeAIAuth,
} from '../services/oauth/client.js'
import { getOauthProfileFromOauthToken } from '../services/oauth/getOauthProfile.js'
import type { OAuthTokens, SubscriptionType } from '../services/oauth/types.js'
import {
  getApiKeyFromFileDescriptor,
  getOAuthTokenFromFileDescriptor,
} from './authFileDescriptor.js'
import {
  maybeRemoveApiKeyFromMacOSKeychainThrows,
  normalizeApiKeyForConfig,
} from './authPortable.js'
import {
  checkStsCallerIdentity,
  clearAwsIniCache,
  isValidAwsStsOutput,
} from './aws.js'
import { AwsAuthStatusManager } from './awsAuthStatusManager.js'
import { clearBetasCaches } from './betas.js'
import {
  type AccountInfo,
  checkHasTrustDialogAccepted,
  getGlobalConfig,
  saveGlobalConfig,
} from './config.js'
import { logAntError, logForDebugging } from './debug.js'
import {
  getClaudeConfigHomeDir,
  isBareMode,
  isEnvTruthy,
  isRunningOnHomespace,
} from './envUtils.js'
import { errorMessage } from './errors.js'
import { execSyncWithDefaults_DEPRECATED } from './execFileNoThrow.js'
import * as lockfile from './lockfile.js'
import { logError } from './log.js'
import { memoizeWithTTLAsync } from './memoize.js'
import { getSecureStorage } from './secureStorage/index.js'
import {
  clearLegacyApiKeyPrefetch,
  getLegacyApiKeyPrefetchResult,
} from './secureStorage/keychainPrefetch.js'
import {
  clearKeychainCache,
  getMacOsKeychainStorageServiceName,
  getUsername,
} from './secureStorage/macOsKeychainHelpers.js'
import {
  getSettings_DEPRECATED,
  getSettingsForSource,
} from './settings/settings.js'
import { sleep } from './sleep.js'
import { jsonParse } from './slowOperations.js'
import { clearToolSchemaCache } from './toolSchemaCache.js'

/** Default TTL for API key helper cache in milliseconds (5 minutes) */
const DEFAULT_API_KEY_HELPER_TTL = 5 * 60 * 1000

/**
 * CCR and Claude Desktop spawn the CLI with OAuth and should never fall back
 * to the user's ~/.claude/settings.json API-key config (apiKeyHelper,
 * env.ANTHROPIC_API_KEY, env.ANTHROPIC_AUTH_TOKEN). Those settings exist for
 * the user's terminal CLI, not managed sessions. Without this guard, a user
 * who runs `claude` in their terminal with an API key sees every CCD session
 * also use that key — and fail if it's stale/wrong-org.
 */
function isManagedOAuthContext(): boolean {
  return (
    isEnvTruthy(process.env.CLAUDE_CODE_REMOTE) ||
    process.env.CLAUDE_CODE_ENTRYPOINT === 'claude-desktop'
  )
}

/** Whether we are supporting direct 1P auth. */
// this code is closely related to getAuthTokenSource
export function isAnthropicAuthEnabled(): boolean {
  // --bare: API-key-only, never OAuth.
  if (isBareMode()) return false

  // `claude ssh` remote: ANTHROPIC_UNIX_SOCKET tunnels API calls through a
  // local auth-injecting proxy. The launcher sets CLAUDE_CODE_OAUTH_TOKEN as a
  // placeholder iff the local side is a subscriber (so the remote includes the
  // oauth-2025 beta header to match what the proxy will inject). The remote's
  // ~/.claude settings (apiKeyHelper, settings.env.ANTHROPIC_API_KEY) MUST NOT
  // flip this — they'd cause a header mismatch with the proxy and a bogus
  // "invalid x-api-key" from the API. See src/ssh/sshAuthProxy.ts.
  if (process.env.ANTHROPIC_UNIX_SOCKET) {
    return !!process.env.CLAUDE_CODE_OAUTH_TOKEN
  }

  const is3P =
    isEnvTruthy(process.env.CLAUDE_CODE_USE_BEDROCK) ||
    isEnvTruthy(process.env.CLAUDE_CODE_USE_VERTEX) ||
    isEnvTruthy(process.env.CLAUDE_CODE_USE_FOUNDRY)

  // Check if user has configured an external API key source
  // This allows externally-provided API keys to work (without requiring proxy configuration)
  const settings = getSettings_DEPRECATED() || {}
  const apiKeyHelper = settings.apiKeyHelper
  const hasExternalAuthToken =
    process.env.ANTHROPIC_AUTH_TOKEN ||
    apiKeyHelper ||
    process.env.CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR

  // Check if API key is from an external source (not managed by /login)
  const { source: apiKeySource } = getAnthropicApiKeyWithSource({
    skipRetrievingKeyFromApiKeyHelper: true,
  })
  const hasExternalApiKey =
    apiKeySource === 'ANTHROPIC_API_KEY' || apiKeySource === 'apiKeyHelper'

  // Disable Anthropic auth if:
  // 1. Using 3rd party services (Bedrock/Vertex/Foundry)
  // 2. User has an external API key (regardless of proxy configuration)
  // 3. User has an external auth token (regardless of proxy configuration)
  // this may cause issues if users have complex proxy / gateway "client-side creds" auth scenarios,
  // e.g. if they want to set X-Api-Key to a gateway key but use Anthropic OAuth for the Authorization
  // if we get reports of that, we should probably add an env var to force OAuth enablement
  const shouldDisableAuth =
    is3P ||
    (hasExternalAuthToken && !isManagedOAuthContext()) ||
    (hasExternalApiKey && !isManagedOAuthContext())

  return !shouldDisableAuth
}

/** Where the auth token is being sourced from, if any. */
// this code is closely related to isAnthropicAuthEnabled
export function getAuthTokenSource() {
  // --bare: API-key-only. apiKeyHelper (from --settings) is the only
  // bearer-token-shaped source allowed. OAuth env vars, FD tokens, and
  // keychain are ignored.
  if (isBareMode()) {
    if (getConfiguredApiKeyHelper()) {
      return { source: 'apiKeyHelper' as const, hasToken: true }
    }
    return { source: 'none' as const, hasToken: false }
  }

  if (process.env.ANTHROPIC_AUTH_TOKEN && !isManagedOAuthContext()) {
    return { source: 'ANTHROPIC_AUTH_TOKEN' as const, hasToken: true }
  }

  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    return { source: 'CLAUDE_CODE_OAUTH_TOKEN' as const, hasToken: true }
  }

  // Check for OAuth token from file descriptor (or its CCR disk fallback)
  const oauthTokenFromFd = getOAuthTokenFromFileDescriptor()
  if (oauthTokenFromFd) {
    // getOAuthTokenFromFileDescriptor has a disk fallback for CCR subprocesses
    // that can't inherit the pipe FD. Distinguish by env var presence so the
    // org-mismatch message doesn't tell the user to unset a variable that
    // doesn't exist. Call sites fall through correctly — the new source is
    // !== 'none' (cli/handlers/auth.ts → oauth_token) and not in the
    // isEnvVarToken set (auth.ts:1844 → generic re-login message).
    if (process.env.CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR) {
      return {
        source: 'CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR' as const,
        hasToken: true,
      }
    }
    return {
      source: 'CCR_OAUTH_TOKEN_FILE' as const,
      hasToken: true,
    }
  }

  // Check if apiKeyHelper is configured without executing it
  // This prevents security issues where arbitrary code could execute before trust is established
  const apiKeyHelper = getConfiguredApiKeyHelper()
  if (apiKeyHelper && !isManagedOAuthContext()) {
    return { source: 'apiKeyHelper' as const, hasToken: true }
  }

  const oauthTokens = getClaudeAIOAuthTokens()
  if (shouldUseClaudeAIAuth(oauthTokens?.scopes) && oauthTokens?.accessToken) {
    return { source: 'claude.ai' as const, hasToken: true }
  }

  return { source: 'none' as const, hasToken: false }
}

export type ApiKeySource =
  | 'ANTHROPIC_API_KEY'
  | 'apiKeyHelper'
  | '/login managed key'
  | 'none'

export function getAnthropicApiKey(): null | string {
  const { key } = getAnthropicApiKeyWithSource()
  return key
}

export function hasAnthropicApiKeyAuth(): boolean {
  const { key, source } = getAnthropicApiKeyWithSource({
    skipRetrievingKeyFromApiKeyHelper: true,
  })
  return key !== null && source !== 'none'
}

export function getAnthropicApiKeyWithSource(
  opts: { skipRetrievingKeyFromApiKeyHelper?: boolean } = {},
): {
  key: null | string
  source: ApiKeySource
} {
  // --bare: hermetic auth. Only ANTHROPIC_API_KEY env or apiKeyHelper from
  // the --settings flag. Never touches keychain, config file, or approval
  // lists. 3P (Bedrock/Vertex/Foundry) uses provider creds, not this path.
  if (isBareMode()) {
    if (process.env.ANTHROPIC_API_KEY) {
      return { key: process.env.ANTHROPIC_API_KEY, source: 'ANTHROPIC_API_KEY' }
    }
    if (getConfiguredApiKeyHelper()) {
      return {
        key: opts.skipRetrievingKeyFromApiKeyHelper
          ? null
          : getApiKeyFromApiKeyHelperCached(),
        source: 'apiKeyHelper',
      }
    }
    return { key: null, source: 'none' }
  }

  // On homespace, don't use ANTHROPIC_API_KEY (use Console key instead)
  // https://anthropic.slack.com/archives/C08428WSLKV/p1747331773214779
  const apiKeyEnv = isRunningOnHomespace()
    ? undefined
    : process.env.ANTHROPIC_API_KEY

  // Always check for direct environment variable when the user ran claude --print.
  // This is useful for CI, etc.
  if (preferThirdPartyAuthentication() && apiKeyEnv) {
    return {
      key: apiKeyEnv,
      source: 'ANTHROPIC_API_KEY',
    }
  }

  if (isEnvTruthy(process.env.CI) || process.env.NODE_ENV === 'test') {
    // Check for API key from file descriptor first
    const apiKeyFromFd = getApiKeyFromFileDescriptor()
    if (apiKeyFromFd) {
      return {
        key: apiKeyFromFd,
        source: 'ANTHROPIC_API_KEY',
      }
    }

    if (
      !apiKeyEnv &&
      !process.env.CLAUDE_CODE_OAUTH_TOKEN &&
      !process.env.CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR
    ) {
      throw new Error(
        'ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN env var is required',
      )
    }

    if (apiKeyEnv) {
      return {
        key: apiKeyEnv,
        source: 'ANTHROPIC_API_KEY',
      }
    }

    // OAuth token is present but this function returns API keys only
    return {
      key: null,
      source: 'none',
    }
  }
  // Check for ANTHROPIC_API_KEY before checking the apiKeyHelper or /login-managed key
  if (
    apiKeyEnv &&
    getGlobalConfig().customApiKeyResponses?.approved?.includes(
      normalizeApiKeyForConfig(apiKeyEnv),
    )
  ) {
    return {
      key: apiKeyEnv,
      source: 'ANTHROPIC_API_KEY',
    }
  }

  // Check for API key from file descriptor
  const apiKeyFromFd = getApiKeyFromFileDescriptor()
  if (apiKeyFromFd) {
    return {
      key: apiKeyFromFd,
      source: 'ANTHROPIC_API_KEY',
    }
  }

  // Check for apiKeyHelper — use sync cache, never block
  const apiKeyHelperCommand = getConfiguredApiKeyHelper()
  if (apiKeyHelperCommand) {
    if (opts.skipRetrievingKeyFromApiKeyHelper) {
      return {
        key: null,
        source: 'apiKeyHelper',
      }
    }
    // Cache may be cold (helper hasn't finished yet). Return null with
    // source='apiKeyHelper' rather than falling through to keychain —
    // apiKeyHelper must win. Callers needing a real key must await
    // getApiKeyFromApiKeyHelper() first (client.ts, useApiKeyVerification do).
    return {
      key: getApiKeyFromApiKeyHelperCached(),
      source: 'apiKeyHelper',
    }
  }

  const apiKeyFromConfigOrMacOSKeychain = getApiKeyFromConfigOrMacOSKeychain()
  if (apiKeyFromConfigOrMacOSKeychain) {
    return apiKeyFromConfigOrMacOSKeychain
  }

  return {
    key: null,
    source: 'none',
  }
}

/**
 * Get the configured apiKeyHelper from settings.
 * In bare mode, only the --settings flag source is consulted — apiKeyHelper
 * from ~/.claude/settings.json or project settings is ignored.
 */
export function getConfiguredApiKeyHelper(): string | undefined {
  if (isBareMode()) {
    return getSettingsForSource('flagSettings')?.apiKeyHelper
  }
  const mergedSettings = getSettings_DEPRECATED() || {}
  return mergedSettings.apiKeyHelper
}

/**
 * Check if the configured apiKeyHelper comes from project settings (projectSettings or localSettings)
 */
function isApiKeyHelperFromProjectOrLocalSettings(): boolean {
  const apiKeyHelper = getConfiguredApiKeyHelper()
  if (!apiKeyHelper) {
    return false
  }

  const projectSettings = getSettingsForSource('projectSettings')
  const localSettings = getSettingsForSource('localSettings')
  return (
    projectSettings?.apiKeyHelper === apiKeyHelper ||
    localSettings?.apiKeyHelper === apiKeyHelper
  )
}

/**
 * Get the configured awsAuthRefresh from settings
 */
function getConfiguredAwsAuthRefresh(): string | undefined {
  const mergedSettings = getSettings_DEPRECATED() || {}
  return mergedSettings.awsAuthRefresh
}

/**
 * Check if the configured awsAuthRefresh comes from project settings
 */
export function isAwsAuthRefreshFromProjectSettings(): boolean {
  const awsAuthRefresh = getConfiguredAwsAuthRefresh()
  if (!awsAuthRefresh) {
    return false
  }

  const projectSettings = getSettingsForSource('projectSettings')
  const localSettings = getSettingsForSource('localSettings')
  return (
    projectSettings?.awsAuthRefresh === awsAuthRefresh ||
    localSettings?.awsAuthRefresh === awsAuthRefresh
  )
}

/**
 * Get the configured awsCredentialExport from settings
 */
function getConfiguredAwsCredentialExport(): string | undefined {
  const mergedSettings = getSettings_DEPRECATED() || {}
  return mergedSettings.awsCredentialExport
}

/**
 * Check if the configured awsCredentialExport comes from project settings
 */
export function isAwsCredentialExportFromProjectSettings(): boolean {
  const awsCredentialExport = getConfiguredAwsCredentialExport()
  if (!awsCredentialExport) {
    return false
  }

  const projectSettings = getSettingsForSource('projectSettings')
  const localSettings = getSettingsForSource('localSettings')
  return (
    projectSettings?.awsCredentialExport === awsCredentialExport ||
    localSettings?.awsCredentialExport === awsCredentialExport
  )
}

/**
 * Calculate TTL in milliseconds for the API key helper cache
 * Uses CLAUDE_CODE_API_KEY_HELPER_TTL_MS env var if set and valid,
 * otherwise defaults to 5 minutes
 */
export function calculateApiKeyHelperTTL(): number {
  const envTtl = process.env.CLAUDE_CODE_API_KEY_HELPER_TTL_MS

  if (envTtl) {
    const parsed = parseInt(envTtl, 10)
    if (!Number.isNaN(parsed) && parsed >= 0) {
      return parsed
    }
    logForDebugging(
      `Found CLAUDE_CODE_API_KEY_HELPER_TTL_MS env var, but it was not a valid number. Got ${envTtl}`,
      { level: 'error' },
    )
  }

  return DEFAULT_API_KEY_HELPER_TTL
}

// Async API key helper with sync cache for non-blocking reads.
// Epoch bumps on clearApiKeyHelperCache() — orphaned executions check their
// captured epoch before touching module state so a settings-change or 401-retry
// mid-flight can't clobber the newer cache/inflight.
let _apiKeyHelperCache: { value: string; timestamp: number } | null = null
let _apiKeyHelperInflight: {
  promise: Promise<string | null>
  // Only set on cold launches (user is waiting); null for SWR background refreshes.
  startedAt: number | null
} | null = null
let _apiKeyHelperEpoch = 0

export function getApiKeyHelperElapsedMs(): number {
  const startedAt = _apiKeyHelperInflight?.startedAt
  return startedAt ? Date.now() - startedAt : 0
}

export async function getApiKeyFromApiKeyHelper(
  isNonInteractiveSession: boolean,
): Promise<string | null> {
  if (!getConfiguredApiKeyHelper()) return null
  const ttl = calculateApiKeyHelperTTL()
  if (_apiKeyHelperCache) {
    if (Date.now() - _apiKeyHelperCache.timestamp < ttl) {
      return _apiKeyHelperCache.value
    }
    // Stale — return stale value now, refresh in the background.
    // `??=` banned here by eslint no-nullish-assign-object-call (bun bug).
    if (!_apiKeyHelperInflight) {
      _apiKeyHelperInflight = {
        promise: _runAndCache(
          isNonInteractiveSession,
          false,
          _apiKeyHelperEpoch,
        ),
        startedAt: null,
      }
    }
    return _apiKeyHelperCache.value
  }
  // Cold cache — deduplicate concurrent calls
  if (_apiKeyHelperInflight) return _apiKeyHelperInflight.promise
  _apiKeyHelperInflight = {
    promise: _runAndCache(isNonInteractiveSession, true, _apiKeyHelperEpoch),
    startedAt: Date.now(),
  }
  return _apiKeyHelperInflight.promise
}

async function _runAndCache(
  isNonInteractiveSession: boolean,
  isCold: boolean,
  epoch: number,
): Promise<string | null> {
  try {
    const value = await _executeApiKeyHelper(isNonInteractiveSession)
    if (epoch !== _apiKeyHelperEpoch) return value
    if (value !== null) {
      _apiKeyHelperCache = { value, timestamp: Date.now() }
    }
    return value
  } catch (e) {
    if (epoch !== _apiKeyHelperEpoch) return ' '
    const detail = e instanceof Error ? e.message : String(e)
    // biome-ignore lint/suspicious/noConsole: user-configured script failed; must be visible without --debug
    console.error(chalk.red(`apiKeyHelper failed: ${detail}`))
    logForDebugging(`Error getting API key from apiKeyHelper: ${detail}`, {
      level: 'error',
    })
    // SWR path: a transient failure shouldn't replace a working key with
    // the ' ' sentinel — keep serving the stale value and bump timestamp
    // so we don't hammer-retry every call.
    if (!isCold && _apiKeyHelperCache && _apiKeyHelperCache.value !== ' ') {
      _apiKeyHelperCache = { ..._apiKeyHelperCache, timestamp: Date.now() }
      return _apiKeyHelperCache.value
    }
    // Cold cache or prior error — cache ' ' so callers don't fall back to OAuth
    _apiKeyHelperCache = { value: ' ', timestamp: Date.now() }
    return ' '
  } finally {
    if (epoch === _apiKeyHelperEpoch) {
      _apiKeyHelperInflight = null
    }
  }
}

async function _executeApiKeyHelper(
  isNonInteractiveSession: boolean,
): Promise<string | null> {
  const apiKeyHelper = getConfiguredApiKeyHelper()
  if (!apiKeyHelper) {
    return null
  }

  if (isApiKeyHelperFromProjectOrLocalSettings()) {
    const hasTrust = checkHasTrustDialogAccepted()
    if (!hasTrust && !isNonInteractiveSession) {
      const error = new Error(
        `Security: apiKeyHelper executed before workspace trust is confirmed. If you see this message, post in ${MACRO.FEEDBACK_CHANNEL}.`,
      )
      logAntError('apiKeyHelper invoked before trust check', error)
      logEvent('tengu_apiKeyHelper_missing_trust11', {})
      return null
    }
  }

  const result = await execa(apiKeyHelper, {
    shell: true,
    timeout: 10 * 60 * 1000,
    reject: false,
  })
  if (result.failed) {
    // reject:false — execa resolves on exit≠0/timeout, stderr is on result
    const why = result.timedOut ? 'timed out' : `exited ${result.exitCode}`
    const stderr = result.stderr?.trim()
    throw new Error(stderr ? `${why}: ${stderr}` : why)
  }
  const stdout = result.stdout?.trim()
  if (!stdout) {
    throw new Error('did not return a value')
  }
  return stdout
}

/**
 * Sync cache reader — returns the last fetched apiKeyHelper value without executing.
 * Returns stale values to match SWR semantics of the async reader.
 * Returns null only if the async fetch hasn't completed yet.
 */
export function getApiKeyFromApiKeyHelperCached(): string | null {
  return _apiKeyHelperCache?.value ?? null
}

export function clearApiKeyHelperCache(): void {
  _apiKeyHelperEpoch++
  _apiKeyHelperCache = null
  _apiKeyHelperInflight = null
}

export function prefetchApiKeyFromApiKeyHelperIfSafe(
  isNonInteractiveSession: boolean,
): void {
  // Skip if trust not yet accepted — the inner _executeApiKeyHelper check
  // would catch this too, but would fire a false-positive analytics event.
  if (
    isApiKeyHelperFromProjectOrLocalSettings() &&
    !checkHasTrustDialogAccepted()
  ) {
    return
  }
  void getApiKeyFromApiKeyHelper(isNonInteractiveSession)
}

/** Default STS credentials are one hour. We manually manage invalidation, so not too worried about this being accurate. */
const DEFAULT_AWS_STS_TTL = 60 * 60 * 1000

/**
 * Run awsAuthRefresh to perform interactive authentication (e.g., aws sso login)
 * Streams output in real-time for user visibility
 */
async function runAwsAuthRefresh(): Promise<boolean> {
  const awsAuthRefresh = getConfiguredAwsAuthRefresh()

  if (!awsAuthRefresh) {
    return false // Not configured, treat as success
  }

  // SECURITY: Check if awsAuthRefresh is from project settings
  if (isAwsAuthRefreshFromProjectSettings()) {
    // Check if trust has been established for this project
    const hasTrust = checkHasTrustDialogAccepted()
    if (!hasTrust && !getIsNonInteractiveSession()) {
      const error = new Error(
        `Security: awsAuthRefresh executed before workspace trust is confirmed. If you see this message, post in ${MACRO.FEEDBACK_CHANNEL}.`,
      )
      logAntError('awsAuthRefresh invoked before trust check', error)
      logEvent('tengu_awsAuthRefresh_missing_trust', {})
      return false
    }
  }

  try {
    logForDebugging('Fetching AWS caller identity for AWS auth refresh command')
    await checkStsCallerIdentity()
    logForDebugging(
      'Fetched AWS caller identity, skipping AWS auth refresh command',
    )
    return false
  } catch {
    // only actually do the refresh if caller-identity calls
    return refreshAwsAuth(awsAuthRefresh)
  }
}

// Timeout for AWS auth refresh command (3 minutes).
// Long enough for browser-based SSO flows, short enough to prevent indefinite hangs.
const AWS_AUTH_REFRESH_TIMEOUT_MS = 3 * 60 * 1000

export function refreshAwsAuth(awsAuthRefresh: string): Promise<boolean> {
  logForDebugging('Running AWS auth refresh command')
  // Start tracking authentication status
  const authStatusManager = AwsAuthStatusManager.getInstance()
  authStatusManager.startAuthentication()

  return new Promise(resolve => {
    const refreshProc = exec(awsAuthRefresh, {
      timeout: AWS_AUTH_REFRESH_TIMEOUT_MS,
    })
    refreshProc.stdout!.on('data', data => {
      const output = data.toString().trim()
      if (output) {
        // Add output to status manager for UI display
        authStatusManager.addOutput(output)
        // Also log for debugging
        logForDebugging(output, { level: 'debug' })
      }
    })

    refreshProc.stderr!.on('data', data => {
      const error = data.toString().trim()
      if (error) {
        authStatusManager.setError(error)
        logForDebugging(error, { level: 'error' })
      }
    })

    refreshProc.on('close', (code, signal) => {
      if (code === 0) {
        logForDebugging('AWS auth refresh completed successfully')
        authStatusManager.endAuthentication(true)
        void resolve(true)
      } else {
        const timedOut = signal === 'SIGTERM'
        const message = timedOut
          ? chalk.red(
              'AWS auth refresh timed out after 3 minutes. Run your auth command manually in a separate terminal.',
            )
          : chalk.red(
              'Error running awsAuthRefresh (in settings or ~/.claude.json):',
            )
        // biome-ignore lint/suspicious/noConsole:: intentional console output
        console.error(message)
        authStatusManager.endAuthentication(false)
        void resolve(false)
      }
    })
  })
}

/**
 * Run awsCredentialExport to get credentials and set environment variables
 * Expects JSON output containing AWS credentials
 */
async function getAwsCredsFromCredentialExport(): Promise<{
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
} | null> {
  const awsCredentialExport = getConfiguredAwsCredentialExport()

  if (!awsCredentialExport) {
    return null
  }

  // SECURITY: Check if awsCredentialExport is from project settings
  if (isAwsCredentialExportFromProjectSettings()) {
    // Check if trust has been established for this project
    const hasTrust = checkHasTrustDialogAccepted()
    if (!hasTrust && !getIsNonInteractiveSession()) {
      const error = new Error(
        `Security: awsCredentialExport executed before workspace trust is confirmed. If you see this message, post in ${MACRO.FEEDBACK_CHANNEL}.`,
      )
      logAntError('awsCredentialExport invoked before trust check', error)
      logEvent('tengu_awsCredentialExport_missing_trust', {})
      return null
    }
  }

  try {
    logForDebugging(
      'Fetching AWS caller identity for credential export command',
    )
    await checkStsCallerIdentity()
    logForDebugging(
      'Fetched AWS caller identity, skipping AWS credential export command',
    )
    return null
  } catch {
    // only actually do the export if caller-identity calls
    try {
      logForDebugging('Running AWS credential export command')
      const result = await execa(awsCredentialExport, {
        shell: true,
        reject: false,
      })
      if (result.exitCode !== 0 || !result.stdout) {
        throw new Error('awsCredentialExport did not return a valid value')
      }

      // Parse the JSON output from aws sts commands
      const awsOutput = jsonParse(result.stdout.trim())

      if (!isValidAwsStsOutput(awsOutput)) {
        throw new Error(
          'awsCredentialExport did not return valid AWS STS output structure',
        )
      }

      logForDebugging('AWS credentials retrieved from awsCredentialExport')
      return {
        accessKeyId: awsOutput.Credentials.AccessKeyId,
        secretAccessKey: awsOutput.Credentials.SecretAccessKey,
        sessionToken: awsOutput.Credentials.SessionToken,
      }
    } catch (e) {
      const message = chalk.red(
        'Error getting AWS credentials from awsCredentialExport (in settings or ~/.claude.json):',
      )
      if (e instanceof Error) {
        // biome-ignore lint/suspicious/noConsole:: intentional console output
        console.error(message, e.message)
      } else {
        // biome-ignore lint/suspicious/noConsole:: intentional console output
        console.error(message, e)
      }
      return null
    }
  }
}

/**
 * Refresh AWS authentication and get credentials with cache clearing
 * This combines runAwsAuthRefresh, getAwsCredsFromCredentialExport, and clearAwsIniCache
 * to ensure fresh credentials are always used
 */
export const refreshAndGetAwsCredentials = memoizeWithTTLAsync(
  async (): Promise<{
    accessKeyId: string
    secretAccessKey: string
    sessionToken: string
  } | null> => {
    // First run auth refresh if needed
    const refreshed = await runAwsAuthRefresh()

    // Get credentials from export
    const credentials = await getAwsCredsFromCredentialExport()

    // Clear AWS INI cache to ensure fresh credentials are used
    if (refreshed || credentials) {
      await clearAwsIniCache()
    }

    return credentials
  },
  DEFAULT_AWS_STS_TTL,
)

export function clearAwsCredentialsCache(): void {
  refreshAndGetAwsCredentials.cache.clear()
}

/**
 * Get the configured gcpAuthRefresh from settings
 */
function getConfiguredGcpAuthRefresh(): string | undefined {
  const mergedSettings = getSettings_DEPRECATED() || {}
  return mergedSettings.gcpAuthRefresh
}

/**
 * Check if the configured gcpAuthRefresh comes from project settings
 */
export function isGcpAuthRefreshFromProjectSettings(): boolean {
  const gcpAuthRefresh = getConfiguredGcpAuthRefresh()
  if (!gcpAuthRefresh) {
    return false
  }

  const projectSettings = getSettingsForSource('projectSettings')
  const localSettings = getSettingsForSource('localSettings')
  return (
    projectSettings?.gcpAuthRefresh === gcpAuthRefresh ||
    localSettings?.gcpAuthRefresh === gcpAuthRefresh
  )
}

/** Short timeout for the GCP credentials probe. Without this, when no local
 *  credential source exists (no ADC file, no env var), google-auth-library falls
 *  through to the GCE metadata server which hangs ~12s outside GCP. */
const GCP_CREDENTIALS_CHECK_TIMEOUT_MS = 5_000

/**
 * Check if GCP credentials are currently valid by attempting to get an access token.
 * This uses the same authentication chain that the Vertex SDK uses.
 */
export async function checkGcpCredentialsValid(): Promise<boolean> {
  try {
    // Dynamically import to avoid loading google-auth-library unnecessarily
    const { GoogleAuth } = await import('google-auth-library')
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    })
    const probe = (async () => {
      const client = await auth.getClient()
      await client.getAccessToken()
    })()
    const timeout = sleep(GCP_CREDENTIALS_CHECK_TIMEOUT_MS).then(() => {
      throw new GcpCredentialsTimeoutError('GCP credentials check timed out')
    })
    await Promise.race([probe, timeout])
    return true
  } catch {
    return false
  }
}

/** Default GCP credential TTL - 1 hour to match typical ADC token lifetime */
const DEFAULT_GCP_CREDENTIAL_TTL = 60 * 60 * 1000

/**
 * Run gcpAuthRefresh to perform interactive authentication (e.g., gcloud auth application-default login)
 * Streams output in real-time for user visibility
 */
async function runGcpAuthRefresh(): Promise<boolean> {
  const gcpAuthRefresh = getConfiguredGcpAuthRefresh()

  if (!gcpAuthRefresh) {
    return false // Not configured, treat as success
  }

  // SECURITY: Check if gcpAuthRefresh is from project settings
  if (isGcpAuthRefreshFromProjectSettings()) {
    // Check if trust has been established for this project
    // Pass true to indicate this is a dangerous feature that requires trust
    const hasTrust = checkHasTrustDialogAccepted()
    if (!hasTrust && !getIsNonInteractiveSession()) {
      const error = new Error(
        `Security: gcpAuthRefresh executed before workspace trust is confirmed. If you see this message, post in ${MACRO.FEEDBACK_CHANNEL}.`,
      )
      logAntError('gcpAuthRefresh invoked before trust check', error)
      logEvent('tengu_gcpAuthRefresh_missing_trust', {})
      return false
    }
  }

  try {
    logForDebugging('Checking GCP credentials validity for auth refresh')
    const isValid = await checkGcpCredentialsValid()
    if (isValid) {
      logForDebugging(
        'GCP credentials are valid, skipping auth refresh command',
      )
      return false
    }
  } catch {
    // Credentials check failed, proceed with refresh
  }

  return refreshGcpAuth(gcpAuthRefresh)
}

// Timeout for GCP auth refresh command (3 minutes).
// Long enough for browser-based auth flows, short enough to prevent indefinite hangs.
const GCP_AUTH_REFRESH_TIMEOUT_MS = 3 * 60 * 1000

export function refreshGcpAuth(gcpAuthRefresh: string): Promise<boolean> {
  logForDebugging('Running GCP auth refresh command')
  // Start tracking authentication status. AwsAuthStatusManager is cloud-provider-agnostic
  // despite the name — print.ts emits its updates as generic SDK 'auth_status' messages.
  const authStatusManager = AwsAuthStatusManager.getInstance()
  authStatusManager.startAuthentication()

  return new Promise(resolve => {
    const refreshProc = exec(gcpAuthRefresh, {
      timeout: GCP_AUTH_REFRESH_TIMEOUT_MS,
    })
    refreshProc.stdout!.on('data', data => {
      const output = data.toString().trim()
      if (output) {
        // Add output to status manager for UI display
        authStatusManager.addOutput(output)
        // Also log for debugging
        logForDebugging(output, { level: 'debug' })
      }
    })

    refreshProc.stderr!.on('data', data => {
      const error = data.toString().trim()
      if (error) {
        authStatusManager.setError(error)
        logForDebugging(error, { level: 'error' })
      }
    })

    refreshProc.on('close', (code, signal) => {
      if (code === 0) {
        logForDebugging('GCP auth refresh completed successfully')
        authStatusManager.endAuthentication(true)
        void resolve(true)
      } else {
        const timedOut = signal === 'SIGTERM'
        const message = timedOut
          ? chalk.red(
              'GCP auth refresh timed out after 3 minutes. Run your auth command manually in a separate terminal.',
            )
          : chalk.red(
              'Error running gcpAuthRefresh (in settings or ~/.claude.json):',
            )
        // biome-ignore lint/suspicious/noConsole:: intentional console output
        console.error(message)
        authStatusManager.endAuthentication(false)
        void resolve(false)
      }
    })
  })
}

/**
 * Refresh GCP authentication if needed.
 * This function checks if credentials are valid and runs the refresh command if not.
 * Memoized with TTL to avoid excessive refresh attempts.
 */
export const refreshGcpCredentialsIfNeeded = memoizeWithTTLAsync(
  async (): Promise<boolean> => {
    // Run auth refresh if needed
    const refreshed = await runGcpAuthRefresh()
    return refreshed
  },
  DEFAULT_GCP_CREDENTIAL_TTL,
)

export function clearGcpCredentialsCache(): void {
  refreshGcpCredentialsIfNeeded.cache.clear()
}

/**
 * Prefetches GCP credentials only if workspace trust has already been established.
 * This allows us to start the potentially slow GCP commands early for trusted workspaces
 * while maintaining security for untrusted ones.
 *
 * Returns void to prevent misuse - use refreshGcpCredentialsIfNeeded() to actually refresh.
 */
export function prefetchGcpCredentialsIfSafe(): void {
  // Check if gcpAuthRefresh is configured
  const gcpAuthRefresh = getConfiguredGcpAuthRefresh()

  if (!gcpAuthRefresh) {
    return
  }

  // Check if gcpAuthRefresh is from project settings
  if (isGcpAuthRefreshFromProjectSettings()) {
    // Only prefetch if trust has already been established
    const hasTrust = checkHasTrustDialogAccepted()
    if (!hasTrust && !getIsNonInteractiveSession()) {
      // Don't prefetch - wait for trust to be established first
      return
    }
  }

  // Safe to prefetch - either not from project settings or trust already established
  void refreshGcpCredentialsIfNeeded()
}

/**
 * Prefetches AWS credentials only if workspace trust has already been established.
 * This allows us to start the potentially slow AWS commands early for trusted workspaces
 * while maintaining security for untrusted ones.
 *
 * Returns void to prevent misuse - use refreshAndGetAwsCredentials() to actually retrieve credentials.
 */
export function prefetchAwsCredentialsAndBedRockInfoIfSafe(): void {
  // Check if either AWS command is configured
  const awsAuthRefresh = getConfiguredAwsAuthRefresh()
  const awsCredentialExport = getConfiguredAwsCredentialExport()

  if (!awsAuthRefresh && !awsCredentialExport) {
    return
  }

  // Check if either command is from project settings
  if (
    isAwsAuthRefreshFromProjectSettings() ||
    isAwsCredentialExportFromProjectSettings()
  ) {
    // Only prefetch if trust has already been established
    const hasTrust = checkHasTrustDialogAccepted()
    if (!hasTrust && !getIsNonInteractiveSession()) {
      // Don't prefetch - wait for trust to be established first
      return
    }
  }

  // Safe to prefetch - either not from project settings or trust already established
  void refreshAndGetAwsCredentials()
  getModelStrings()
}

/** @private Use {@link getAnthropicApiKey} or {@link getAnthropicApiKeyWithSource} */
export const getApiKeyFromConfigOrMacOSKeychain = memoize(
  (): { key: string; source: ApiKeySource } | null => {
    if (isBareMode()) return null
    // TODO: migrate to SecureStorage
    if (process.platform === 'darwin') {
      // keychainPrefetch.ts fires this read at main.tsx top-level in parallel
      // with module imports. If it completed, use that instead of spawning a
      // sync `security` subprocess here (~33ms).
      const prefetch = getLegacyApiKeyPrefetchResult()
      if (prefetch) {
        if (prefetch.stdout) {
          return { key: prefetch.stdout, source: '/login managed key' }
        }
        // Prefetch completed with no key — fall through to config, not keychain.
      } else {
        const storageServiceName = getMacOsKeychainStorageServiceName()
        try {
          const result = execSyncWithDefaults_DEPRECATED(
            `security find-generic-password -a $USER -w -s "${storageServiceName}"`,
          )
          if (result) {
            return { key: result, source: '/login managed key' }
          }
        } catch (e) {
          logError(e)
        }
      }
    }

    const config = getGlobalConfig()
    if (!config.primaryApiKey) {
      return null
    }

    return { key: config.primaryApiKey, source: '/login managed key' }
  },
)

function isValidApiKey(apiKey: string): boolean {
  // Only allow alphanumeric characters, dashes, and underscores
  return /^[a-zA-Z0-9-_]+$/.test(apiKey)
}

export async function saveApiKey(apiKey: string): Promise<void> {
  if (!isValidApiKey(apiKey)) {
    throw new Error(
      'Invalid API key format. API key must contain only alphanumeric characters, dashes, and underscores.',
    )
  }

  // Store as primary API key
  await maybeRemoveApiKeyFromMacOSKeychain()
  let savedToKeychain = false
  if (process.platform === 'darwin') {
    try {
      // TODO: migrate to SecureStorage
      const storageServiceName = getMacOsKeychainStorageServiceName()
      const username = getUsername()

      // Convert to hexadecimal to avoid any escaping issues
      const hexValue = Buffer.from(apiKey, 'utf-8').toString('hex')

      // Use security's interactive mode (-i) with -X (hexadecimal) option
      // This ensures credentials never appear in process command-line arguments
      // Process monitors only see "security -i", not the password
      const command = `add-generic-password -U -a "${username}" -s "${storageServiceName}" -X "${hexValue}"\n`

      await execa('security', ['-i'], {
        input: command,
        reject: false,
      })

      logEvent('tengu_api_key_saved_to_keychain', {})
      savedToKeychain = true
    } catch (e) {
      logError(e)
      logEvent('tengu_api_key_keychain_error', {
        error: errorMessage(
          e,
        ) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      })
      logEvent('tengu_api_key_saved_to_config', {})
    }
  } else {
    logEvent('tengu_api_key_saved_to_config', {})
  }

  const normalizedKey = normalizeApiKeyForConfig(apiKey)

  // Save config with all updates
  saveGlobalConfig(current => {
    const approved = current.customApiKeyResponses?.approved ?? []
    return {
      ...current,
      // Only save to config if keychain save failed or not on darwin
      primaryApiKey: savedToKeychain ? current.primaryApiKey : apiKey,
      customApiKeyResponses: {
        ...current.customApiKeyResponses,
        approved: approved.includes(normalizedKey)
          ? approved
          : [...approved, normalizedKey],
        rejected: current.customApiKeyResponses?.rejected ?? [],
      },
    }
  })

  // Clear memo cache
  getApiKeyFromConfigOrMacOSKeychain.cache.clear?.()
  clearLegacyApiKeyPrefetch()
}

export function isCustomApiKeyApproved(apiKey: string): boolean {
  const config = getGlobalConfig()
  const normalizedKey = normalizeApiKeyForConfig(apiKey)
  return (
    config.customApiKeyResponses?.approved?.includes(normalizedKey) ?? false
  )
}

export async function removeApiKey(): Promise<void> {
  await maybeRemoveApiKeyFromMacOSKeychain()

  // Also remove from config instead of returning early, for older clients
  // that set keys before we supported keychain.
  saveGlobalConfig(current => ({
    ...current,
    primaryApiKey: undefined,
  }))

  // Clear memo cache
  getApiKeyFromConfigOrMacOSKeychain.cache.clear?.()
  clearLegacyApiKeyPrefetch()
}

async function maybeRemoveApiKeyFromMacOSKeychain(): Promise<void> {
  try {
    await maybeRemoveApiKeyFromMacOSKeychainThrows()
  } catch (e) {
    logError(e)
  }
}

// Function to store OAuth tokens in secure storage
export function saveOAuthTokensIfNeeded(tokens: OAuthTokens): {
  success: boolean
  warning?: string
} {
  if (!shouldUseClaudeAIAuth(tokens.scopes)) {
    logEvent('tengu_oauth_tokens_not_claude_ai', {})
    return { success: true }
  }

  // Skip saving inference-only tokens (they come from env vars)
  if (!tokens.refreshToken || !tokens.expiresAt) {
    logEvent('tengu_oauth_tokens_inference_only', {})
    return { success: true }
  }

  const secureStorage = getSecureStorage()
  const storageBackend =
    secureStorage.name as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS

  try {
    const storageData = secureStorage.read() || {}
    const existingOauth = storageData.claudeAiOauth

    storageData.claudeAiOauth = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
      // Profile fetch in refreshOAuthToken swallows errors and returns null on
      // transient failures (network, 5xx, rate limit). Don't clobber a valid
      // stored subscription with null — fall back to the existing value.
      subscriptionType:
        tokens.subscriptionType ?? existingOauth?.subscriptionType ?? null,
      rateLimitTier:
        tokens.rateLimitTier ?? existingOauth?.rateLimitTier ?? null,
    }

    const updateStatus = secureStorage.update(storageData)

    if (updateStatus.success) {
      logEvent('tengu_oauth_tokens_saved', { storageBackend })
    } else {
      logEvent('tengu_oauth_tokens_save_failed', { storageBackend })
    }

    getClaudeAIOAuthTokens.cache?.clear?.()
    clearBetasCaches()
    clearToolSchemaCache()
    return updateStatus
  } catch (error) {
    logError(error)
    logEvent('tengu_oauth_tokens_save_exception', {
      storageBackend,
      error: errorMessage(
        error,
      ) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
    return { success: false, warning: 'Failed to save OAuth tokens' }
  }
}

export const getClaudeAIOAuthTokens = memoize((): OAuthTokens | null => {
  // --bare: API-key-only. No OAuth env tokens, no keychain, no credentials file.
  if (isBareMode()) return null

  // Check for force-set OAuth token from environment variable
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    // Return an inference-only token (unknown refresh and expiry)
    return {
      accessToken: process.env.CLAUDE_CODE_OAUTH_TOKEN,
      refreshToken: null,
      expiresAt: null,
      scopes: ['user:inference'],
      subscriptionType: null,
      rateLimitTier: null,
    }
  }

  // Check for OAuth token from file descriptor
  const oauthTokenFromFd = getOAuthTokenFromFileDescriptor()
  if (oauthTokenFromFd) {
    // Return an inference-only token (unknown refresh and expiry)
    return {
      accessToken: oauthTokenFromFd,
      refreshToken: null,
      expiresAt: null,
      scopes: ['user:inference'],
      subscriptionType: null,
      rateLimitTier: null,
    }
  }

  try {
    const secureStorage = getSecureStorage()
    const storageData = secureStorage.read()
    const oauthData = storageData?.claudeAiOauth

    if (!oauthData?.accessToken) {
      return null
    }

    return oauthData
  } catch (error) {
    logError(error)
    return null
  }
})

/**
 * Clears all OAuth token caches. Call this on 401 errors to ensure
 * the next token read comes from secure storage, not stale in-memory caches.
 * This handles the case where the local expiration check disagrees with the
 * server (e.g., due to clock corrections after token was issued).
 */
export function clearOAuthTokenCache(): void {
  getClaudeAIOAuthTokens.cache?.clear?.()
  clearKeychainCache()
}

let lastCredentialsMtimeMs = 0

// Cross-process staleness: another CC instance may write fresh tokens to
// disk (refresh or /login), but this process's memoize caches forever.
// Without this, terminal 1's /login fixes terminal 1; terminal 2's /login
// then revokes terminal 1 server-side, and terminal 1's memoize never
// re-reads — infinite /login regress (CC-1096, GH#24317).
async function invalidateOAuthCacheIfDiskChanged(): Promise<void> {
  try {
    const { mtimeMs } = await stat(
      join(getClaudeConfigHomeDir(), '.credentials.json'),
    )
    if (mtimeMs !== lastCredentialsMtimeMs) {
      lastCredentialsMtimeMs = mtimeMs
      clearOAuthTokenCache()
    }
  } catch {
    // ENOENT — macOS keychain path (file deleted on migration). Clear only
    // the memoize so it delegates to the keychain cache's 30s TTL instead
    // of caching forever on top. `security find-generic-password` is
    // ~15ms; bounded to once per 30s by the keychain cache.
    getClaudeAIOAuthTokens.cache?.clear?.()
  }
}

// In-flight dedup: when N claude.ai proxy connectors hit 401 with the same
// token simultaneously (common at startup — #20930), only one should clear
// caches and re-read the keychain. Without this, each call's clearOAuthTokenCache()
// nukes readInFlight in macOsKeychainStorage and triggers a fresh spawn —
// sync spawns stacked to 800ms+ of blocked render frames.
const pending401Handlers = new Map<string, Promise<boolean>>()

/**
 * Handle a 401 "OAuth token has expired" error from the API.
 *
 * This function forces a token refresh when the server says the token is expired,
 * even if our local expiration check disagrees (which can happen due to clock
 * issues when the token was issued).
 *
 * Safety: We compare the failed token with what's in keychain. If another tab
 * already refreshed (different token in keychain), we use that instead of
 * refreshing again. Concurrent calls with the same failedAccessToken are
 * deduplicated to a single keychain read.
 *
 * @param failedAccessToken - The access token that was rejected with 401
 * @returns true if we now have a valid token, false otherwise
 */
export function handleOAuth401Error(
  failedAccessToken: string,
): Promise<boolean> {
  const pending = pending401Handlers.get(failedAccessToken)
  if (pending) return pending

  const promise = handleOAuth401ErrorImpl(failedAccessToken).finally(() => {
    pending401Handlers.delete(failedAccessToken)
  })
  pending401Handlers.set(failedAccessToken, promise)
  return promise
}

async function handleOAuth401ErrorImpl(
  failedAccessToken: string,
): Promise<boolean> {
  // Clear caches and re-read from keychain (async — sync read blocks ~100ms/call)
  clearOAuthTokenCache()
  const currentTokens = await getClaudeAIOAuthTokensAsync()

  if (!currentTokens?.refreshToken) {
    return false
  }

  // If keychain has a different token, another tab already refreshed - use it
  if (currentTokens.accessToken !== failedAccessToken) {
    logEvent('tengu_oauth_401_recovered_from_keychain', {})
    return true
  }

  // Same token that failed - force refresh, bypassing local expiration check
  return checkAndRefreshOAuthTokenIfNeeded(0, true)
}

/**
 * Reads OAuth tokens asynchronously, avoiding blocking keychain reads.
 * Delegates to the sync memoized version for env var / file descriptor tokens
 * (which don't hit the keychain), and only uses async for storage reads.
 */
export async function getClaudeAIOAuthTokensAsync(): Promise<OAuthTokens | null> {
  if (isBareMode()) return null

  // Env var and FD tokens are sync and don't hit the keychain
  if (
    process.env.CLAUDE_CODE_OAUTH_TOKEN ||
    getOAuthTokenFromFileDescriptor()
  ) {
    return getClaudeAIOAuthTokens()
  }

  try {
    const secureStorage = getSecureStorage()
    const storageData = await secureStorage.readAsync()
    const oauthData = storageData?.claudeAiOauth
    if (!oauthData?.accessToken) {
      return null
    }
    return oauthData
  } catch (error) {
    logError(error)
    return null
  }
}

// In-flight promise for deduplicating concurrent calls
let pendingRefreshCheck: Promise<boolean> | null = null

export function checkAndRefreshOAuthTokenIfNeeded(
  retryCount = 0,
  force = false,
): Promise<boolean> {
  // Deduplicate concurrent non-retry, non-force calls
  if (retryCount === 0 && !force) {
    if (pendingRefreshCheck) {
      return pendingRefreshCheck
    }

    const promise = checkAndRefreshOAuthTokenIfNeededImpl(retryCount, force)
    pendingRefreshCheck = promise.finally(() => {
      pendingRefreshCheck = null
    })
    return pendingRefreshCheck
  }

  return checkAndRefreshOAuthTokenIfNeededImpl(retryCount, force)
}

async function checkAndRefreshOAuthTokenIfNeededImpl(
  retryCount: number,
  force: boolean,
): Promise<boolean> {
  const MAX_RETRIES = 5

  await invalidateOAuthCacheIfDiskChanged()

  // First check if token is expired with cached value
  // Skip this check if force=true (server already told us token is bad)
  const tokens = getClaudeAIOAuthTokens()
  if (!force) {
    if (!tokens?.refreshToken || !isOAuthTokenExpired(tokens.expiresAt)) {
      return false
    }
  }

  if (!tokens?.refreshToken) {
    return false
  }

  if (!shouldUseClaudeAIAuth(tokens.scopes)) {
    return false
  }

  // Re-read tokens async to check if they're still expired
  // Another process might have refreshed them
  getClaudeAIOAuthTokens.cache?.clear?.()
  clearKeychainCache()
  const freshTokens = await getClaudeAIOAuthTokensAsync()
  if (
    !freshTokens?.refreshToken ||
    !isOAuthTokenExpired(freshTokens.expiresAt)
  ) {
    return false
  }

  // Tokens are still expired, try to acquire lock and refresh
  const claudeDir = getClaudeConfigHomeDir()
  await mkdir(claudeDir, { recursive: true })

  let release
  try {
    logEvent('tengu_oauth_token_refresh_lock_acquiring', {})
    release = await lockfile.lock(claudeDir)
    logEvent('tengu_oauth_token_refresh_lock_acquired', {})
  } catch (err) {
    if ((err as { code?: string }).code === 'ELOCKED') {
      // Another process has the lock, let's retry if we haven't exceeded max retries
      if (retryCount < MAX_RETRIES) {
        logEvent('tengu_oauth_token_refresh_lock_retry', {
          retryCount: retryCount + 1,
        })
        // Wait a bit before retrying
        await sleep(1000 + Math.random() * 1000)
        return checkAndRefreshOAuthTokenIfNeededImpl(retryCount + 1, force)
      }
      logEvent('tengu_oauth_token_refresh_lock_retry_limit_reached', {
        maxRetries: MAX_RETRIES,
      })
      return false
    }
    logError(err)
    logEvent('tengu_oauth_token_refresh_lock_error', {
      error: errorMessage(
        err,
      ) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
    return false
  }
  try {
    // Check one more time after acquiring lock
    getClaudeAIOAuthTokens.cache?.clear?.()
    clearKeychainCache()
    const lockedTokens = await getClaudeAIOAuthTokensAsync()
    if (
      !lockedTokens?.refreshToken ||
      !isOAuthTokenExpired(lockedTokens.expiresAt)
    ) {
      logEvent('tengu_oauth_token_refresh_race_resolved', {})
      return false
    }

    logEvent('tengu_oauth_token_refresh_starting', {})
    const refreshedTokens = await refreshOAuthToken(lockedTokens.refreshToken, {
      // For Claude.ai subscribers, omit scopes so the default
      // CLAUDE_AI_OAUTH_SCOPES applies — this allows scope expansion
      // (e.g. adding user:file_upload) on refresh without re-login.
      scopes: shouldUseClaudeAIAuth(lockedTokens.scopes)
        ? undefined
        : lockedTokens.scopes,
    })
    saveOAuthTokensIfNeeded(refreshedTokens)

    // Clear the cache after refreshing token
    getClaudeAIOAuthTokens.cache?.clear?.()
    clearKeychainCache()
    return true
  } catch (error) {
    logError(error)

    getClaudeAIOAuthTokens.cache?.clear?.()
    clearKeychainCache()
    const currentTokens = await getClaudeAIOAuthTokensAsync()
    if (currentTokens && !isOAuthTokenExpired(currentTokens.expiresAt)) {
      logEvent('tengu_oauth_token_refresh_race_recovered', {})
      return true
    }

    return false
  } finally {
    logEvent('tengu_oauth_token_refresh_lock_releasing', {})
    await release()
    logEvent('tengu_oauth_token_refresh_lock_released', {})
  }
}

export function isClaudeAISubscriber(): boolean {
  if (!isAnthropicAuthEnabled()) {
    return false
  }

  return shouldUseClaudeAIAuth(getClaudeAIOAuthTokens()?.scopes)
}

/**
 * Check if the current OAuth token has the user:profile scope.
 *
 * Real /login tokens always include this scope. Env-var and file-descriptor
 * tokens (service keys) hardcode scopes to ['user:inference'] only. Use this
 * to gate calls to profile-scoped endpoints so service key sessions don't
 * generate 403 storms against /api/oauth/profile, bootstrap, etc.
 */
export function hasProfileScope(): boolean {
  return (
    getClaudeAIOAuthTokens()?.scopes?.includes(CLAUDE_AI_PROFILE_SCOPE) ?? false
  )
}

export function is1PApiCustomer(): boolean {
  // 1P API customers are users who are NOT:
  // 1. Claude.ai subscribers (Max, Pro, Enterprise, Team)
  // 2. Vertex AI users
  // 3. AWS Bedrock users
  // 4. Foundry users

  // Exclude Vertex, Bedrock, and Foundry customers
  if (
    isEnvTruthy(process.env.CLAUDE_CODE_USE_BEDROCK) ||
    isEnvTruthy(process.env.CLAUDE_CODE_USE_VERTEX) ||
    isEnvTruthy(process.env.CLAUDE_CODE_USE_FOUNDRY)
  ) {
    return false
  }

  // Exclude Claude.ai subscribers
  if (isClaudeAISubscriber()) {
    return false
  }

  // Everyone else is an API customer (OAuth API customers, direct API key users, etc.)
  return true
}

/**
 * Gets OAuth account information when Anthropic auth is enabled.
 * Returns undefined when using external API keys or third-party services.
 */
export function getOauthAccountInfo(): AccountInfo | undefined {
  return isAnthropicAuthEnabled() ? getGlobalConfig().oauthAccount : undefined
}

/**
 * Checks if overage/extra usage provisioning is allowed for this organization.
 * This mirrors the logic in apps/claude-ai `useIsOverageProvisioningAllowed` hook as closely as possible.
 */
export function isOverageProvisioningAllowed(): boolean {
  const accountInfo = getOauthAccountInfo()
  const billingType = accountInfo?.billingType

  // Must be a Claude subscriber with a supported subscription type
  if (!isClaudeAISubscriber() || !billingType) {
    return false
  }

  // only allow Stripe and mobile billing types to purchase extra usage
  if (
    billingType !== 'stripe_subscription' &&
    billingType !== 'stripe_subscription_contracted' &&
    billingType !== 'apple_subscription' &&
    billingType !== 'google_play_subscription'
  ) {
    return false
  }

  return true
}

// Returns whether the user has Opus access at all, regardless of whether they
// are a subscriber or PayG.
export function hasOpusAccess(): boolean {
  const subscriptionType = getSubscriptionType()

  return (
    subscriptionType === 'max' ||
    subscriptionType === 'enterprise' ||
    subscriptionType === 'team' ||
    subscriptionType === 'pro' ||
    // subscriptionType === null covers both API users and the case where
    // subscribers do not have subscription type populated. For those
    // subscribers, when in doubt, we should not limit their access to Opus.
    subscriptionType === null
  )
}

export function getSubscriptionType(): SubscriptionType | null {
  // Check for mock subscription type first (ANT-only testing)
  if (shouldUseMockSubscription()) {
    return getMockSubscriptionType()
  }

  if (!isAnthropicAuthEnabled()) {
    return null
  }
  const oauthTokens = getClaudeAIOAuthTokens()
  if (!oauthTokens) {
    return null
  }

  return oauthTokens.subscriptionType ?? null
}

export function isMaxSubscriber(): boolean {
  return getSubscriptionType() === 'max'
}

export function isTeamSubscriber(): boolean {
  return getSubscriptionType() === 'team'
}

export function isTeamPremiumSubscriber(): boolean {
  return (
    getSubscriptionType() === 'team' &&
    getRateLimitTier() === 'default_claude_max_5x'
  )
}

export function isEnterpriseSubscriber(): boolean {
  return getSubscriptionType() === 'enterprise'
}

export function isProSubscriber(): boolean {
  return getSubscriptionType() === 'pro'
}

export function getRateLimitTier(): string | null {
  if (!isAnthropicAuthEnabled()) {
    return null
  }
  const oauthTokens = getClaudeAIOAuthTokens()
  if (!oauthTokens) {
    return null
  }

  return oauthTokens.rateLimitTier ?? null
}

export function getSubscriptionName(): string {
  const subscriptionType = getSubscriptionType()

  switch (subscriptionType) {
    case 'enterprise':
      return 'Claude Enterprise'
    case 'team':
      return 'Claude Team'
    case 'max':
      return 'Claude Max'
    case 'pro':
      return 'Claude Pro'
    default:
      return 'Claude API'
  }
}

/** Check if using third-party services (Bedrock or Vertex or Foundry) */
export function isUsing3PServices(): boolean {
  return !!(
    isEnvTruthy(process.env.CLAUDE_CODE_USE_BEDROCK) ||
    isEnvTruthy(process.env.CLAUDE_CODE_USE_VERTEX) ||
    isEnvTruthy(process.env.CLAUDE_CODE_USE_FOUNDRY)
  )
}

/**
 * Get the configured otelHeadersHelper from settings
 */
function getConfiguredOtelHeadersHelper(): string | undefined {
  const mergedSettings = getSettings_DEPRECATED() || {}
  return mergedSettings.otelHeadersHelper
}

/**
 * Check if the configured otelHeadersHelper comes from project settings (projectSettings or localSettings)
 */
export function isOtelHeadersHelperFromProjectOrLocalSettings(): boolean {
  const otelHeadersHelper = getConfiguredOtelHeadersHelper()
  if (!otelHeadersHelper) {
    return false
  }

  const projectSettings = getSettingsForSource('projectSettings')
  const localSettings = getSettingsForSource('localSettings')
  return (
    projectSettings?.otelHeadersHelper === otelHeadersHelper ||
    localSettings?.otelHeadersHelper === otelHeadersHelper
  )
}

// Cache for debouncing otelHeadersHelper calls
let cachedOtelHeaders: Record<string, string> | null = null
let cachedOtelHeadersTimestamp = 0
const DEFAULT_OTEL_HEADERS_DEBOUNCE_MS = 29 * 60 * 1000 // 29 minutes

export function getOtelHeadersFromHelper(): Record<string, string> {
  const otelHeadersHelper = getConfiguredOtelHeadersHelper()

  if (!otelHeadersHelper) {
    return {}
  }

  // Return cached headers if still valid (debounce)
  const debounceMs = parseInt(
    process.env.CLAUDE_CODE_OTEL_HEADERS_HELPER_DEBOUNCE_MS ||
      DEFAULT_OTEL_HEADERS_DEBOUNCE_MS.toString(),
  )
  if (
    cachedOtelHeaders &&
    Date.now() - cachedOtelHeadersTimestamp < debounceMs
  ) {
    return cachedOtelHeaders
  }

  if (isOtelHeadersHelperFromProjectOrLocalSettings()) {
    // Check if trust has been established for this project
    const hasTrust = checkHasTrustDialogAccepted()
    if (!hasTrust) {
      return {}
    }
  }

  try {
    const result = execSyncWithDefaults_DEPRECATED(otelHeadersHelper, {
      timeout: 30000, // 30 seconds - allows for auth service latency
    })
      ?.toString()
      .trim()
    if (!result) {
      throw new Error('otelHeadersHelper did not return a valid value')
    }

    const headers = jsonParse(result)
    if (
      typeof headers !== 'object' ||
      headers === null ||
      Array.isArray(headers)
    ) {
      throw new Error(
        'otelHeadersHelper must return a JSON object with string key-value pairs',
      )
    }

    // Validate all values are strings
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value !== 'string') {
        throw new Error(
          `otelHeadersHelper returned non-string value for key "${key}": ${typeof value}`,
        )
      }
    }

    // Cache the result
    cachedOtelHeaders = headers as Record<string, string>
    cachedOtelHeadersTimestamp = Date.now()

    return cachedOtelHeaders
  } catch (error) {
    logError(
      new Error(
        `Error getting OpenTelemetry headers from otelHeadersHelper (in settings): ${errorMessage(error)}`,
      ),
    )
    throw error
  }
}

function isConsumerPlan(plan: SubscriptionType): plan is 'max' | 'pro' {
  return plan === 'max' || plan === 'pro'
}

export function isConsumerSubscriber(): boolean {
  const subscriptionType = getSubscriptionType()
  return (
    isClaudeAISubscriber() &&
    subscriptionType !== null &&
    isConsumerPlan(subscriptionType)
  )
}

export type UserAccountInfo = {
  subscription?: string
  tokenSource?: string
  apiKeySource?: ApiKeySource
  organization?: string
  email?: string
}

export function getAccountInformation() {
  const apiProvider = getAPIProvider()
  // Only provide account info for first-party Anthropic API
  if (apiProvider !== 'firstParty') {
    return undefined
  }
  const { source: authTokenSource } = getAuthTokenSource()
  const accountInfo: UserAccountInfo = {}
  if (
    authTokenSource === 'CLAUDE_CODE_OAUTH_TOKEN' ||
    authTokenSource === 'CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR'
  ) {
    accountInfo.tokenSource = authTokenSource
  } else if (isClaudeAISubscriber()) {
    accountInfo.subscription = getSubscriptionName()
  } else {
    accountInfo.tokenSource = authTokenSource
  }
  const { key: apiKey, source: apiKeySource } = getAnthropicApiKeyWithSource()
  if (apiKey) {
    accountInfo.apiKeySource = apiKeySource
  }

  // We don't know the organization if we're relying on an external API key or auth token
  if (
    authTokenSource === 'claude.ai' ||
    apiKeySource === '/login managed key'
  ) {
    // Get organization name from OAuth account info
    const orgName = getOauthAccountInfo()?.organizationName
    if (orgName) {
      accountInfo.organization = orgName
    }
  }
  const email = getOauthAccountInfo()?.emailAddress
  if (
    (authTokenSource === 'claude.ai' ||
      apiKeySource === '/login managed key') &&
    email
  ) {
    accountInfo.email = email
  }
  return accountInfo
}

/**
 * Result of org validation — either success or a descriptive error.
 */
export type OrgValidationResult =
  | { valid: true }
  | { valid: false; message: string }

/**
 * Validate that the active OAuth token belongs to the organization required
 * by `forceLoginOrgUUID` in managed settings. Returns a result object
 * rather than throwing so callers can choose how to surface the error.
 *
 * Fails closed: if `forceLoginOrgUUID` is set and we cannot determine the
 * token's org (network error, missing profile data), validation fails.
 */
export async function validateForceLoginOrg(): Promise<OrgValidationResult> {
  // `claude ssh` remote: real auth lives on the local machine and is injected
  // by the proxy. The placeholder token can't be validated against the profile
  // endpoint. The local side already ran this check before establishing the session.
  if (process.env.ANTHROPIC_UNIX_SOCKET) {
    return { valid: true }
  }

  if (!isAnthropicAuthEnabled()) {
    return { valid: true }
  }

  const requiredOrgUuid =
    getSettingsForSource('policySettings')?.forceLoginOrgUUID
  if (!requiredOrgUuid) {
    return { valid: true }
  }

  // Ensure the access token is fresh before hitting the profile endpoint.
  // No-op for env-var tokens (refreshToken is null).
  await checkAndRefreshOAuthTokenIfNeeded()

  const tokens = getClaudeAIOAuthTokens()
  if (!tokens) {
    return { valid: true }
  }

  // Always fetch the authoritative org UUID from the profile endpoint.
  // Even keychain-sourced tokens verify server-side: the cached org UUID
  // in ~/.claude.json is user-writable and cannot be trusted.
  const { source } = getAuthTokenSource()
  const isEnvVarToken =
    source === 'CLAUDE_CODE_OAUTH_TOKEN' ||
    source === 'CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR'

  const profile = await getOauthProfileFromOauthToken(tokens.accessToken)
  if (!profile) {
    // Fail closed — we can't verify the org
    return {
      valid: false,
      message:
        `Unable to verify organization for the current authentication token.\n` +
        `This machine requires organization ${requiredOrgUuid} but the profile could not be fetched.\n` +
        `This may be a network error, or the token may lack the user:profile scope required for\n` +
        `verification (tokens from 'claude setup-token' do not include this scope).\n` +
        `Try again, or obtain a full-scope token via 'claude auth login'.`,
    }
  }

  const tokenOrgUuid = profile.organization.uuid
  if (tokenOrgUuid === requiredOrgUuid) {
    return { valid: true }
  }

  if (isEnvVarToken) {
    const envVarName =
      source === 'CLAUDE_CODE_OAUTH_TOKEN'
        ? 'CLAUDE_CODE_OAUTH_TOKEN'
        : 'CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR'
    return {
      valid: false,
      message:
        `The ${envVarName} environment variable provides a token for a\n` +
        `different organization than required by this machine's managed settings.\n\n` +
        `Required organization: ${requiredOrgUuid}\n` +
        `Token organization:   ${tokenOrgUuid}\n\n` +
        `Remove the environment variable or obtain a token for the correct organization.`,
    }
  }

  return {
    valid: false,
    message:
      `Your authentication token belongs to organization ${tokenOrgUuid},\n` +
      `but this machine requires organization ${requiredOrgUuid}.\n\n` +
      `Please log in with the correct organization: claude auth login`,
  }
}

class GcpCredentialsTimeoutError extends Error {}
