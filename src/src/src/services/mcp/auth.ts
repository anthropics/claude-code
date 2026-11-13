import {
  discoverAuthorizationServerMetadata,
  discoverOAuthServerInfo,
  type OAuthClientProvider,
  type OAuthDiscoveryState,
  auth as sdkAuth,
  refreshAuthorization as sdkRefreshAuthorization,
} from '@modelcontextprotocol/sdk/client/auth.js'
import {
  InvalidGrantError,
  OAuthError,
  ServerError,
  TemporarilyUnavailableError,
  TooManyRequestsError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js'
import {
  type AuthorizationServerMetadata,
  type OAuthClientInformation,
  type OAuthClientInformationFull,
  type OAuthClientMetadata,
  OAuthErrorResponseSchema,
  OAuthMetadataSchema,
  type OAuthTokens,
  OAuthTokensSchema,
} from '@modelcontextprotocol/sdk/shared/auth.js'
import type { FetchLike } from '@modelcontextprotocol/sdk/shared/transport.js'
import axios from 'axios'
import { createHash, randomBytes, randomUUID } from 'crypto'
import { mkdir } from 'fs/promises'
import { createServer, type Server } from 'http'
import { join } from 'path'
import { parse } from 'url'
import xss from 'xss'
import { MCP_CLIENT_METADATA_URL } from '../../constants/oauth.js'
import { openBrowser } from '../../utils/browser.js'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'
import { errorMessage, getErrnoCode } from '../../utils/errors.js'
import * as lockfile from '../../utils/lockfile.js'
import { logMCPDebug } from '../../utils/log.js'
import { getPlatform } from '../../utils/platform.js'
import { getSecureStorage } from '../../utils/secureStorage/index.js'
import { clearKeychainCache } from '../../utils/secureStorage/macOsKeychainHelpers.js'
import type { SecureStorageData } from '../../utils/secureStorage/types.js'
import { sleep } from '../../utils/sleep.js'
import { jsonParse, jsonStringify } from '../../utils/slowOperations.js'
import { logEvent } from '../analytics/index.js'
import type { AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from '../analytics/metadata.js'
import { buildRedirectUri, findAvailablePort } from './oauthPort.js'
import type { McpHTTPServerConfig, McpSSEServerConfig } from './types.js'
import { getLoggingSafeMcpBaseUrl } from './utils.js'
import { performCrossAppAccess, XaaTokenExchangeError } from './xaa.js'
import {
  acquireIdpIdToken,
  clearIdpIdToken,
  discoverOidc,
  getCachedIdpIdToken,
  getIdpClientSecret,
  getXaaIdpSettings,
  isXaaEnabled,
} from './xaaIdpLogin.js'

/**
 * Timeout for individual OAuth requests (metadata discovery, token refresh, etc.)
 */
const AUTH_REQUEST_TIMEOUT_MS = 30000

/**
 * Failure reasons for the `tengu_mcp_oauth_refresh_failure` event. Values
 * are emitted to analytics — keep them stable (do not rename; add new ones).
 */
type MCPRefreshFailureReason =
  | 'metadata_discovery_failed'
  | 'no_client_info'
  | 'no_tokens_returned'
  | 'invalid_grant'
  | 'transient_retries_exhausted'
  | 'request_failed'

/**
 * Failure reasons for the `tengu_mcp_oauth_flow_error` event. Values are
 * emitted to analytics for attribution in BigQuery. Keep stable (do not
 * rename; add new ones).
 */
type MCPOAuthFlowErrorReason =
  | 'cancelled'
  | 'timeout'
  | 'provider_denied'
  | 'state_mismatch'
  | 'port_unavailable'
  | 'sdk_auth_failed'
  | 'token_exchange_failed'
  | 'unknown'

const MAX_LOCK_RETRIES = 5

/**
 * OAuth query parameters that should be redacted from logs.
 * These contain sensitive values that could enable CSRF or session fixation attacks.
 */
const SENSITIVE_OAUTH_PARAMS = [
  'state',
  'nonce',
  'code_challenge',
  'code_verifier',
  'code',
]

/**
 * Redacts sensitive OAuth query parameters from a URL for safe logging.
 * Prevents exposure of state, nonce, code_challenge, code_verifier, and authorization codes.
 */
function redactSensitiveUrlParams(url: string): string {
  try {
    const parsedUrl = new URL(url)
    for (const param of SENSITIVE_OAUTH_PARAMS) {
      if (parsedUrl.searchParams.has(param)) {
        parsedUrl.searchParams.set(param, '[REDACTED]')
      }
    }
    return parsedUrl.toString()
  } catch {
    // Return as-is if not a valid URL
    return url
  }
}

/**
 * Some OAuth servers (notably Slack) return HTTP 200 for all responses,
 * signaling errors via the JSON body instead. The SDK's executeTokenRequest
 * only calls parseErrorResponse when !response.ok, so a 200 with
 * {"error":"invalid_grant"} gets fed to OAuthTokensSchema.parse() and
 * surfaces as a ZodError — which the refresh retry/invalidation logic
 * treats as opaque request_failed instead of invalid_grant.
 *
 * This wrapper peeks at 2xx POST response bodies and rewrites ones that
 * match OAuthErrorResponseSchema (but not OAuthTokensSchema) to a 400
 * Response, so the SDK's normal error-class mapping applies. The same
 * fetchFn is also used for DCR POSTs, but DCR success responses have no
 * {error: string} field so they don't match the rewrite condition.
 *
 * Slack uses non-standard error codes (invalid_refresh_token observed live
 * at oauth.v2.user.access; expired_refresh_token/token_expired per Slack's
 * token rotation docs) where RFC 6749 specifies invalid_grant. We normalize
 * those so OAUTH_ERRORS['invalid_grant'] → InvalidGrantError matches and
 * token invalidation fires correctly.
 */
const NONSTANDARD_INVALID_GRANT_ALIASES = new Set([
  'invalid_refresh_token',
  'expired_refresh_token',
  'token_expired',
])

/* eslint-disable eslint-plugin-n/no-unsupported-features/node-builtins --
 * Response has been stable in Node since 18; the rule flags it as
 * experimental-until-21 which is incorrect. Pattern matches existing
 * createAuthFetch suppressions in this file. */
export async function normalizeOAuthErrorBody(
  response: Response,
): Promise<Response> {
  if (!response.ok) {
    return response
  }
  const text = await response.text()
  let parsed: unknown
  try {
    parsed = jsonParse(text)
  } catch {
    return new Response(text, response)
  }
  if (OAuthTokensSchema.safeParse(parsed).success) {
    return new Response(text, response)
  }
  const result = OAuthErrorResponseSchema.safeParse(parsed)
  if (!result.success) {
    return new Response(text, response)
  }
  const normalized = NONSTANDARD_INVALID_GRANT_ALIASES.has(result.data.error)
    ? {
        error: 'invalid_grant',
        error_description:
          result.data.error_description ??
          `Server returned non-standard error code: ${result.data.error}`,
      }
    : result.data
  return new Response(jsonStringify(normalized), {
    status: 400,
    statusText: 'Bad Request',
    headers: response.headers,
  })
}
/* eslint-enable eslint-plugin-n/no-unsupported-features/node-builtins */

/**
 * Creates a fetch function with a fresh 30-second timeout for each OAuth request.
 * Used by ClaudeAuthProvider for metadata discovery and token refresh.
 * Prevents stale timeout signals from affecting auth operations.
 */
function createAuthFetch(): FetchLike {
  return async (url: string | URL, init?: RequestInit) => {
    const timeoutSignal = AbortSignal.timeout(AUTH_REQUEST_TIMEOUT_MS)
    const isPost = init?.method?.toUpperCase() === 'POST'

    // No existing signal - just use timeout
    if (!init?.signal) {
      // eslint-disable-next-line eslint-plugin-n/no-unsupported-features/node-builtins
      const response = await fetch(url, { ...init, signal: timeoutSignal })
      return isPost ? normalizeOAuthErrorBody(response) : response
    }

    // Combine signals: abort when either fires
    const controller = new AbortController()
    const abort = () => controller.abort()

    init.signal.addEventListener('abort', abort)
    timeoutSignal.addEventListener('abort', abort)

    // Cleanup to prevent event listener leaks after fetch completes
    const cleanup = () => {
      init.signal?.removeEventListener('abort', abort)
      timeoutSignal.removeEventListener('abort', abort)
    }

    if (init.signal.aborted) {
      controller.abort()
    }

    try {
      // eslint-disable-next-line eslint-plugin-n/no-unsupported-features/node-builtins
      const response = await fetch(url, { ...init, signal: controller.signal })
      cleanup()
      return isPost ? normalizeOAuthErrorBody(response) : response
    } catch (error) {
      cleanup()
      throw error
    }
  }
}

/**
 * Fetches authorization server metadata, using a configured metadata URL if available,
 * otherwise performing RFC 9728 → RFC 8414 discovery via the SDK.
 *
 * Discovery order when no configured URL:
 * 1. RFC 9728: probe /.well-known/oauth-protected-resource on the MCP server,
 *    read authorization_servers[0], then RFC 8414 against that URL.
 * 2. Fallback: RFC 8414 directly against the MCP server URL (path-aware). Covers
 *    legacy servers that co-host auth metadata at /.well-known/oauth-authorization-server/{path}
 *    without implementing RFC 9728. The SDK's own fallback strips the path, so this
 *    preserves the pre-existing path-aware probe for backward compatibility.
 *
 * Note: configuredMetadataUrl is user-controlled via .mcp.json. Project-scoped MCP
 * servers require user approval before connecting (same trust level as the MCP server
 * URL itself). The HTTPS requirement here is defense-in-depth beyond schema validation
 * — RFC 8414 mandates OAuth metadata retrieval over TLS.
 */
async function fetchAuthServerMetadata(
  serverName: string,
  serverUrl: string,
  configuredMetadataUrl: string | undefined,
  fetchFn?: FetchLike,
  resourceMetadataUrl?: URL,
): Promise<Awaited<ReturnType<typeof discoverAuthorizationServerMetadata>>> {
  if (configuredMetadataUrl) {
    if (!configuredMetadataUrl.startsWith('https://')) {
      throw new Error(
        `authServerMetadataUrl must use https:// (got: ${configuredMetadataUrl})`,
      )
    }
    const authFetch = fetchFn ?? createAuthFetch()
    const response = await authFetch(configuredMetadataUrl, {
      headers: { Accept: 'application/json' },
    })
    if (response.ok) {
      return OAuthMetadataSchema.parse(await response.json())
    }
    throw new Error(
      `HTTP ${response.status} fetching configured auth server metadata from ${configuredMetadataUrl}`,
    )
  }

  try {
    const { authorizationServerMetadata } = await discoverOAuthServerInfo(
      serverUrl,
      {
        ...(fetchFn && { fetchFn }),
        ...(resourceMetadataUrl && { resourceMetadataUrl }),
      },
    )
    if (authorizationServerMetadata) {
      return authorizationServerMetadata
    }
  } catch (err) {
    // Any error from the RFC 9728 → RFC 8414 chain (5xx from the root or
    // resolved-AS probe, schema parse failure, network error) — fall through
    // to the legacy path-aware retry.
    logMCPDebug(
      serverName,
      `RFC 9728 discovery failed, falling back: ${errorMessage(err)}`,
    )
  }

  // Fallback only when the URL has a path component; for root URLs the SDK's
  // own fallback already probed the same endpoints.
  const url = new URL(serverUrl)
  if (url.pathname === '/') {
    return undefined
  }
  return discoverAuthorizationServerMetadata(url, {
    ...(fetchFn && { fetchFn }),
  })
}

export class AuthenticationCancelledError extends Error {
  constructor() {
    super('Authentication was cancelled')
    this.name = 'AuthenticationCancelledError'
  }
}

/**
 * Generates a unique key for server credentials based on both name and config hash
 * This prevents credentials from being reused across different servers
 * with the same name or different configurations
 */
export function getServerKey(
  serverName: string,
  serverConfig: McpSSEServerConfig | McpHTTPServerConfig,
): string {
  const configJson = jsonStringify({
    type: serverConfig.type,
    url: serverConfig.url,
    headers: serverConfig.headers || {},
  })

  const hash = createHash('sha256')
    .update(configJson)
    .digest('hex')
    .substring(0, 16)

  return `${serverName}|${hash}`
}

/**
 * True when we have probed this server before (OAuth discovery state is
 * stored) but hold no credentials to try. A connection attempt in this
 * state is guaranteed to 401 — the only way out is the user running
 * /mcp to authenticate.
 */
export function hasMcpDiscoveryButNoToken(
  serverName: string,
  serverConfig: McpSSEServerConfig | McpHTTPServerConfig,
): boolean {
  // XAA servers can silently re-auth via cached id_token even without an
  // access/refresh token — tokens() fires the xaaRefresh path. Skipping the
  // connection here would make that auto-auth branch unreachable after
  // invalidateCredentials('tokens') clears the stored tokens.
  if (isXaaEnabled() && serverConfig.oauth?.xaa) {
    return false
  }
  const serverKey = getServerKey(serverName, serverConfig)
  const entry = getSecureStorage().read()?.mcpOAuth?.[serverKey]
  return entry !== undefined && !entry.accessToken && !entry.refreshToken
}

/**
 * Revokes a single token on the OAuth server.
 *
 * Per RFC 7009, public clients (like Claude Code) should authenticate by including
 * client_id in the request body, NOT via an Authorization header. The Bearer token
 * in an Authorization header is meant for resource owner authentication, not client
 * authentication.
 *
 * However, the MCP spec doesn't explicitly define token revocation behavior, so some
 * servers may not be RFC 7009 compliant. As defensive programming, we:
 * 1. First try the RFC 7009 compliant approach (client_id in body, no Authorization header)
 * 2. If we get a 401, retry with Bearer auth as a fallback for non-compliant servers
 *
 * This fallback should rarely be needed - most servers either accept the compliant
 * approach or ignore unexpected headers.
 */
async function revokeToken({
  serverName,
  endpoint,
  token,
  tokenTypeHint,
  clientId,
  clientSecret,
  accessToken,
  authMethod = 'client_secret_basic',
}: {
  serverName: string
  endpoint: string
  token: string
  tokenTypeHint: 'access_token' | 'refresh_token'
  clientId?: string
  clientSecret?: string
  accessToken?: string
  authMethod?: 'client_secret_basic' | 'client_secret_post'
}): Promise<void> {
  const params = new URLSearchParams()
  params.set('token', token)
  params.set('token_type_hint', tokenTypeHint)

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  }

  // RFC 7009 §2.1 requires client auth per RFC 6749 §2.3. XAA always uses a
  // confidential client at the AS — strict ASes (Okta/Stytch) reject public-
  // client revocation of confidential-client tokens.
  if (clientId && clientSecret) {
    if (authMethod === 'client_secret_post') {
      params.set('client_id', clientId)
      params.set('client_secret', clientSecret)
    } else {
      const basic = Buffer.from(
        `${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`,
      ).toString('base64')
      headers.Authorization = `Basic ${basic}`
    }
  } else if (clientId) {
    params.set('client_id', clientId)
  } else {
    logMCPDebug(
      serverName,
      `No client_id available for ${tokenTypeHint} revocation - server may reject`,
    )
  }

  try {
    await axios.post(endpoint, params, { headers })
    logMCPDebug(serverName, `Successfully revoked ${tokenTypeHint}`)
  } catch (error: unknown) {
    // Fallback for non-RFC-7009-compliant servers that require Bearer auth
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      accessToken
    ) {
      logMCPDebug(
        serverName,
        `Got 401, retrying ${tokenTypeHint} revocation with Bearer auth`,
      )
      // RFC 6749 §2.3.1: must not send more than one auth method. The retry
      // switches to Bearer — clear any client creds from the body.
      params.delete('client_id')
      params.delete('client_secret')
      await axios.post(endpoint, params, {
        headers: { ...headers, Authorization: `Bearer ${accessToken}` },
      })
      logMCPDebug(
        serverName,
        `Successfully revoked ${tokenTypeHint} with Bearer auth`,
      )
    } else {
      throw error
    }
  }
}

/**
 * Revokes tokens on the OAuth server if a revocation endpoint is available.
 * Per RFC 7009, we revoke the refresh token first (the long-lived credential),
 * then the access token. Revoking the refresh token prevents generation of new
 * access tokens and many servers implicitly invalidate associated access tokens.
 */
export async function revokeServerTokens(
  serverName: string,
  serverConfig: McpSSEServerConfig | McpHTTPServerConfig,
  { preserveStepUpState = false }: { preserveStepUpState?: boolean } = {},
): Promise<void> {
  const storage = getSecureStorage()
  const existingData = storage.read()
  if (!existingData?.mcpOAuth) return

  const serverKey = getServerKey(serverName, serverConfig)
  const tokenData = existingData.mcpOAuth[serverKey]

  // Attempt server-side revocation if there are tokens to revoke (best-effort)
  if (tokenData?.accessToken || tokenData?.refreshToken) {
    try {
      // For XAA (and any PRM-discovered auth), the AS is at a different host
      // than the MCP URL — use the persisted discoveryState if we have it.
      const asUrl =
        tokenData.discoveryState?.authorizationServerUrl ?? serverConfig.url
      const metadata = await fetchAuthServerMetadata(
        serverName,
        asUrl,
        serverConfig.oauth?.authServerMetadataUrl,
      )

      if (!metadata) {
        logMCPDebug(serverName, 'No OAuth metadata found')
      } else {
        const revocationEndpoint =
          'revocation_endpoint' in metadata
            ? metadata.revocation_endpoint
            : null
        if (!revocationEndpoint) {
          logMCPDebug(serverName, 'Server does not support token revocation')
        } else {
          const revocationEndpointStr = String(revocationEndpoint)
          // RFC 7009 defines revocation_endpoint_auth_methods_supported
          // separately from the token endpoint's list; prefer it if present.
          const authMethods =
            ('revocation_endpoint_auth_methods_supported' in metadata
              ? metadata.revocation_endpoint_auth_methods_supported
              : undefined) ??
            ('token_endpoint_auth_methods_supported' in metadata
              ? metadata.token_endpoint_auth_methods_supported
              : undefined)
          const authMethod: 'client_secret_basic' | 'client_secret_post' =
            authMethods &&
            !authMethods.includes('client_secret_basic') &&
            authMethods.includes('client_secret_post')
              ? 'client_secret_post'
              : 'client_secret_basic'
          logMCPDebug(
            serverName,
            `Revoking tokens via ${revocationEndpointStr} (${authMethod})`,
          )

          // Revoke refresh token first (more important - prevents future access token generation)
          if (tokenData.refreshToken) {
            try {
              await revokeToken({
                serverName,
                endpoint: revocationEndpointStr,
                token: tokenData.refreshToken,
                tokenTypeHint: 'refresh_token',
                clientId: tokenData.clientId,
                clientSecret: tokenData.clientSecret,
                accessToken: tokenData.accessToken,
                authMethod,
              })
            } catch (error: unknown) {
              // Log but continue
              logMCPDebug(
                serverName,
                `Failed to revoke refresh token: ${errorMessage(error)}`,
              )
            }
          }

          // Then revoke access token (may already be invalidated by refresh token revocation)
          if (tokenData.accessToken) {
            try {
              await revokeToken({
                serverName,
                endpoint: revocationEndpointStr,
                token: tokenData.accessToken,
                tokenTypeHint: 'access_token',
                clientId: tokenData.clientId,
                clientSecret: tokenData.clientSecret,
                accessToken: tokenData.accessToken,
                authMethod,
              })
            } catch (error: unknown) {
              logMCPDebug(
                serverName,
                `Failed to revoke access token: ${errorMessage(error)}`,
              )
            }
          }
        }
      }
    } catch (error: unknown) {
      // Log error but don't throw - revocation is best-effort
      logMCPDebug(serverName, `Failed to revoke tokens: ${errorMessage(error)}`)
    }
  } else {
    logMCPDebug(serverName, 'No tokens to revoke')
  }

  // Always clear local tokens, regardless of server-side revocation result.
  clearServerTokensFromLocalStorage(serverName, serverConfig)

  // When re-authenticating, preserve step-up auth state (scope + discovery)
  // so the next performMCPOAuthFlow can use cached scope instead of
  // re-probing. For "Clear Auth" (default), wipe everything.
  if (
    preserveStepUpState &&
    tokenData &&
    (tokenData.stepUpScope || tokenData.discoveryState)
  ) {
    const freshData = storage.read() || {}
    const updatedData: SecureStorageData = {
      ...freshData,
      mcpOAuth: {
        ...freshData.mcpOAuth,
        [serverKey]: {
          ...freshData.mcpOAuth?.[serverKey],
          serverName,
          serverUrl: serverConfig.url,
          accessToken: freshData.mcpOAuth?.[serverKey]?.accessToken ?? '',
          expiresAt: freshData.mcpOAuth?.[serverKey]?.expiresAt ?? 0,
          ...(tokenData.stepUpScope
            ? { stepUpScope: tokenData.stepUpScope }
            : {}),
          ...(tokenData.discoveryState
            ? {
                // Strip legacy bulky metadata fields here too so users with
                // existing overflowed blobs recover on next re-auth (#30337).
                discoveryState: {
                  authorizationServerUrl:
                    tokenData.discoveryState.authorizationServerUrl,
                  resourceMetadataUrl:
                    tokenData.discoveryState.resourceMetadataUrl,
                },
              }
            : {}),
        },
      },
    }
    storage.update(updatedData)
    logMCPDebug(serverName, 'Preserved step-up auth state across revocation')
  }
}

export function clearServerTokensFromLocalStorage(
  serverName: string,
  serverConfig: McpSSEServerConfig | McpHTTPServerConfig,
): void {
  const storage = getSecureStorage()
  const existingData = storage.read()
  if (!existingData?.mcpOAuth) return

  const serverKey = getServerKey(serverName, serverConfig)
  if (existingData.mcpOAuth[serverKey]) {
    delete existingData.mcpOAuth[serverKey]
    storage.update(existingData)
    logMCPDebug(serverName, 'Cleared stored tokens')
  }
}

type WWWAuthenticateParams = {
  scope?: string
  resourceMetadataUrl?: URL
}

type XaaFailureStage =
  | 'idp_login'
  | 'discovery'
  | 'token_exchange'
  | 'jwt_bearer'

/**
 * XAA (Cross-App Access) auth.
 *
 * One IdP browser login is reused across all XAA-configured MCP servers:
 * 1. Acquire an id_token from the IdP (cached in keychain by issuer; if
 *    missing/expired, runs a standard OIDC authorization_code+PKCE flow
 *    — this is the one browser pop)
 * 2. Run the RFC 8693 + RFC 7523 exchange (no browser)
 * 3. Save tokens to the same keychain slot as normal OAuth
 *
 * IdP connection details come from settings.xaaIdp (configured once via
 * `claude mcp xaa setup`). Per-server config is just `oauth.xaa: true`
 * plus the AS clientId/clientSecret.
 *
 * No silent fallback: if `oauth.xaa` is set, XAA is the only path.
 * All errors are actionable — they tell the user what to run.
 */
async function performMCPXaaAuth(
  serverName: string,
  serverConfig: McpSSEServerConfig | McpHTTPServerConfig,
  onAuthorizationUrl: (url: string) => void,
  abortSignal?: AbortSignal,
  skipBrowserOpen?: boolean,
): Promise<void> {
  if (!serverConfig.oauth?.xaa) {
    throw new Error('XAA: oauth.xaa must be set') // guarded by caller
  }

  // IdP config comes from user-level settings, not per-server.
  const idp = getXaaIdpSettings()
  if (!idp) {
    throw new Error(
      "XAA: no IdP connection configured. Run 'claude mcp xaa setup --issuer <url> --client-id <id> --client-secret' to configure.",
    )
  }

  const clientId = serverConfig.oauth?.clientId
  if (!clientId) {
    throw new Error(
      `XAA: server '${serverName}' needs an AS client_id. Re-add with --client-id.`,
    )
  }

  const clientConfig = getMcpClientConfig(serverName, serverConfig)
  const clientSecret = clientConfig?.clientSecret
  if (!clientSecret) {
    // Diagnostic context for serverKey mismatch debugging. Only computed
    // on the error path so there's no perf cost on success.
    const wantedKey = getServerKey(serverName, serverConfig)
    const haveKeys = Object.keys(
      getSecureStorage().read()?.mcpOAuthClientConfig ?? {},
    )
    const headersForLogging = Object.fromEntries(
      Object.entries(serverConfig.headers ?? {}).map(([k, v]) =>
        k.toLowerCase() === 'authorization' ? [k, '[REDACTED]'] : [k, v],
      ),
    )
    logMCPDebug(
      serverName,
      `XAA: secret lookup miss. wanted=${wantedKey} have=[${haveKeys.join(', ')}] configHeaders=${jsonStringify(headersForLogging)}`,
    )
    throw new Error(
      `XAA: AS client secret not found for '${serverName}'. Re-add with --client-secret.`,
    )
  }

  logMCPDebug(serverName, 'XAA: starting cross-app access flow')

  // IdP client secret lives in a separate keychain slot (keyed by IdP issuer),
  // NOT the AS secret — different trust domain. Optional: if absent, PKCE-only.
  const idpClientSecret = getIdpClientSecret(idp.issuer)

  // Acquire id_token (cached or via one OIDC browser pop at the IdP).
  // Peek the cache first so we can report idTokenCacheHit in analytics before
  // acquireIdpIdToken potentially writes a fresh one.
  const idTokenCacheHit = getCachedIdpIdToken(idp.issuer) !== undefined

  let failureStage: XaaFailureStage = 'idp_login'
  try {
    let idToken
    try {
      idToken = await acquireIdpIdToken({
        idpIssuer: idp.issuer,
        idpClientId: idp.clientId,
        idpClientSecret,
        callbackPort: idp.callbackPort,
        onAuthorizationUrl,
        skipBrowserOpen,
        abortSignal,
      })
    } catch (e) {
      if (abortSignal?.aborted) throw new AuthenticationCancelledError()
      throw e
    }

    // Discover the IdP's token endpoint for the RFC 8693 exchange.
    failureStage = 'discovery'
    const oidc = await discoverOidc(idp.issuer)

    // Run the exchange. performCrossAppAccess throws XaaTokenExchangeError
    // for the IdP leg and "jwt-bearer grant failed" for the AS leg.
    failureStage = 'token_exchange'
    let tokens
    try {
      tokens = await performCrossAppAccess(
        serverConfig.url,
        {
          clientId,
          clientSecret,
          idpClientId: idp.clientId,
          idpClientSecret,
          idpIdToken: idToken,
          idpTokenEndpoint: oidc.token_endpoint,
        },
        serverName,
        abortSignal,
      )
    } catch (e) {
      if (abortSignal?.aborted) throw new AuthenticationCancelledError()
      const msg = errorMessage(e)
      // If the IdP says the id_token is bad, drop it from the cache so the
      // next attempt does a fresh IdP login. XaaTokenExchangeError carries
      // shouldClearIdToken so we key off OAuth semantics (4xx / invalid body
      // → clear; 5xx IdP outage → preserve) rather than substring matching.
      if (e instanceof XaaTokenExchangeError) {
        if (e.shouldClearIdToken) {
          clearIdpIdToken(idp.issuer)
          logMCPDebug(
            serverName,
            'XAA: cleared cached id_token after token-exchange failure',
          )
        }
      } else if (
        msg.includes('PRM discovery failed') ||
        msg.includes('AS metadata discovery failed') ||
        msg.includes('no authorization server supports jwt-bearer')
      ) {
        // performCrossAppAccess runs PRM + AS discovery before the actual
        // exchange — don't attribute their failures to 'token_exchange'.
        failureStage = 'discovery'
      } else if (msg.includes('jwt-bearer')) {
        failureStage = 'jwt_bearer'
      }
      throw e
    }

    // Save tokens via the same storage path as normal OAuth. We write directly
    // (instead of ClaudeAuthProvider.saveTokens) to avoid instantiating the
    // whole provider just to write the same keys.
    const storage = getSecureStorage()
    const existingData = storage.read() || {}
    const serverKey = getServerKey(serverName, serverConfig)
    const prev = existingData.mcpOAuth?.[serverKey]
    storage.update({
      ...existingData,
      mcpOAuth: {
        ...existingData.mcpOAuth,
        [serverKey]: {
          ...prev,
          serverName,
          serverUrl: serverConfig.url,
          accessToken: tokens.access_token,
          // AS may omit refresh_token on jwt-bearer — preserve any existing one
          refreshToken: tokens.refresh_token ?? prev?.refreshToken,
          expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
          scope: tokens.scope,
          clientId,
          clientSecret,
          // Persist the AS URL so _doRefresh and revokeServerTokens can locate
          // the token/revocation endpoints when MCP URL ≠ AS URL (the common
          // XAA topology).
          discoveryState: {
            authorizationServerUrl: tokens.authorizationServerUrl,
          },
        },
      },
    })

    logMCPDebug(serverName, 'XAA: tokens saved')
    logEvent('tengu_mcp_oauth_flow_success', {
      authMethod:
        'xaa' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      idTokenCacheHit,
    })
  } catch (e) {
    // User-initiated cancel (Esc during IdP browser pop) isn't a failure.
    if (e instanceof AuthenticationCancelledError) {
      throw e
    }
    logEvent('tengu_mcp_oauth_flow_failure', {
      authMethod:
        'xaa' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      xaaFailureStage:
        failureStage as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      idTokenCacheHit,
    })
    throw e
  }
}

export async function performMCPOAuthFlow(
  serverName: string,
  serverConfig: McpSSEServerConfig | McpHTTPServerConfig,
  onAuthorizationUrl: (url: string) => void,
  abortSignal?: AbortSignal,
  options?: {
    skipBrowserOpen?: boolean
    onWaitingForCallback?: (submit: (callbackUrl: string) => void) => void
  },
): Promise<void> {
  // XAA (SEP-990): if configured, bypass the per-server consent dance.
  // If the IdP id_token isn't cached, this pops the browser once at the IdP
  // (shared across all XAA servers for that issuer). Subsequent servers hit
  // the cache and are silent. Tokens land in the same keychain slot, so the
  // rest of CC's transport wiring (ClaudeAuthProvider.tokens() in client.ts)
  // works unchanged.
  //
  // No silent fallback: if `oauth.xaa` is set, XAA is the only path. We
  // never fall through to the consent flow — that would be surprising (the
  // user explicitly asked for XAA) and security-relevant (consent flow may
  // have a different trust/scope posture than the org's IdP policy).
  //
  // Servers with `oauth.xaa` but CLAUDE_CODE_ENABLE_XAA unset hard-fail with
  // actionable copy rather than silently degrade to consent.
  if (serverConfig.oauth?.xaa) {
    if (!isXaaEnabled()) {
      throw new Error(
        `XAA is not enabled (set CLAUDE_CODE_ENABLE_XAA=1). Remove 'oauth.xaa' from server '${serverName}' to use the standard consent flow.`,
      )
    }
    logEvent('tengu_mcp_oauth_flow_start', {
      isOAuthFlow: true,
      authMethod:
        'xaa' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      transportType:
        serverConfig.type as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      ...(getLoggingSafeMcpBaseUrl(serverConfig)
        ? {
            mcpServerBaseUrl: getLoggingSafeMcpBaseUrl(
              serverConfig,
            ) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          }
        : {}),
    })
    // performMCPXaaAuth logs its own success/failure events (with
    // idTokenCacheHit + xaaFailureStage).
    await performMCPXaaAuth(
      serverName,
      serverConfig,
      onAuthorizationUrl,
      abortSignal,
      options?.skipBrowserOpen,
    )
    return
  }

  // Check for cached step-up scope and resource metadata URL before clearing
  // tokens. The transport-attached auth provider persists scope when it receives
  // a step-up 401, so we can use it here instead of making an extra probe request.
  const storage = getSecureStorage()
  const serverKey = getServerKey(serverName, serverConfig)
  const cachedEntry = storage.read()?.mcpOAuth?.[serverKey]
  const cachedStepUpScope = cachedEntry?.stepUpScope
  const cachedResourceMetadataUrl =
    cachedEntry?.discoveryState?.resourceMetadataUrl

  // Clear any existing stored credentials to ensure fresh client registration.
  // Note: this deletes the entire entry (including discoveryState/stepUpScope),
  // but we already read the cached values above.
  clearServerTokensFromLocalStorage(serverName, serverConfig)

  // Use cached step-up scope and resource metadata URL if available.
  // The transport-attached auth provider caches these when it receives a
  // step-up 401, so we don't need to probe the server again.
  let resourceMetadataUrl: URL | undefined
  if (cachedResourceMetadataUrl) {
    try {
      resourceMetadataUrl = new URL(cachedResourceMetadataUrl)
    } catch {
      logMCPDebug(
        serverName,
        `Invalid cached resourceMetadataUrl: ${cachedResourceMetadataUrl}`,
      )
    }
  }
  const wwwAuthParams: WWWAuthenticateParams = {
    scope: cachedStepUpScope,
    resourceMetadataUrl,
  }

  const flowAttemptId = randomUUID()

  logEvent('tengu_mcp_oauth_flow_start', {
    flowAttemptId:
      flowAttemptId as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    isOAuthFlow: true,
    transportType:
      serverConfig.type as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    ...(getLoggingSafeMcpBaseUrl(serverConfig)
      ? {
          mcpServerBaseUrl: getLoggingSafeMcpBaseUrl(
            serverConfig,
          ) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        }
      : {}),
  })

  // Track whether we reached the token-exchange phase so the catch block can
  // attribute the failure reason correctly.
  let authorizationCodeObtained = false

  try {
    // Use configured callback port for pre-configured OAuth, otherwise find an available port
    const configuredCallbackPort = serverConfig.oauth?.callbackPort
    const port = configuredCallbackPort ?? (await findAvailablePort())
    const redirectUri = buildRedirectUri(port)
    logMCPDebug(
      serverName,
      `Using redirect port: ${port}${configuredCallbackPort ? ' (from config)' : ''}`,
    )

    const provider = new ClaudeAuthProvider(
      serverName,
      serverConfig,
      redirectUri,
      true,
      onAuthorizationUrl,
      options?.skipBrowserOpen,
    )

    // Fetch and store OAuth metadata for scope information
    try {
      const metadata = await fetchAuthServerMetadata(
        serverName,
        serverConfig.url,
        serverConfig.oauth?.authServerMetadataUrl,
        undefined,
        wwwAuthParams.resourceMetadataUrl,
      )
      if (metadata) {
        // Store metadata in provider for scope information
        provider.setMetadata(metadata)
        logMCPDebug(
          serverName,
          `Fetched OAuth metadata with scope: ${getScopeFromMetadata(metadata) || 'NONE'}`,
        )
      }
    } catch (error) {
      logMCPDebug(
        serverName,
        `Failed to fetch OAuth metadata: ${errorMessage(error)}`,
      )
    }

    // Get the OAuth state from the provider for validation
    const oauthState = await provider.state()

    // Store the server, timeout, and abort listener references for cleanup
    let server: Server | null = null
    let timeoutId: NodeJS.Timeout | null = null
    let abortHandler: (() => void) | null = null

    const cleanup = () => {
      if (server) {
        server.removeAllListeners()
        // Defensive: removeAllListeners() strips the error handler, so swallow any late error during close
        server.on('error', () => {})
        server.close()
        server = null
      }
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      if (abortSignal && abortHandler) {
        abortSignal.removeEventListener('abort', abortHandler)
        abortHandler = null
      }
      logMCPDebug(serverName, `MCP OAuth server cleaned up`)
    }

    // Setup a server to receive the callback
    const authorizationCode = await new Promise<string>((resolve, reject) => {
      let resolved = false
      const resolveOnce = (code: string) => {
        if (resolved) return
        resolved = true
        resolve(code)
      }
      const rejectOnce = (error: Error) => {
        if (resolved) return
        resolved = true
        reject(error)
      }

      if (abortSignal) {
        abortHandler = () => {
          cleanup()
          rejectOnce(new AuthenticationCancelledError())
        }
        if (abortSignal.aborted) {
          abortHandler()
          return
        }
        abortSignal.addEventListener('abort', abortHandler)
      }

      // Allow manual callback URL paste for remote/browser-based environments
      // where localhost is not reachable from the user's browser.
      if (options?.onWaitingForCallback) {
        options.onWaitingForCallback((callbackUrl: string) => {
          try {
            const parsed = new URL(callbackUrl)
            const code = parsed.searchParams.get('code')
            const state = parsed.searchParams.get('state')
            const error = parsed.searchParams.get('error')

            if (error) {
              const errorDescription =
                parsed.searchParams.get('error_description') || ''
              cleanup()
              rejectOnce(
                new Error(`OAuth error: ${error} - ${errorDescription}`),
              )
              return
            }

            if (!code) {
              // Not a valid callback URL, ignore so the user can try again
              return
            }

            if (state !== oauthState) {
              cleanup()
              rejectOnce(
                new Error('OAuth state mismatch - possible CSRF attack'),
              )
              return
            }

            logMCPDebug(
              serverName,
              `Received auth code via manual callback URL`,
            )
            cleanup()
            resolveOnce(code)
          } catch {
            // Invalid URL, ignore so the user can try again
          }
        })
      }

      server = createServer((req, res) => {
        const parsedUrl = parse(req.url || '', true)

        if (parsedUrl.pathname === '/callback') {
          const code = parsedUrl.query.code as string
          const state = parsedUrl.query.state as string
          const error = parsedUrl.query.error
          const errorDescription = parsedUrl.query.error_description as string
          const errorUri = parsedUrl.query.error_uri as string

          // Validate OAuth state to prevent CSRF attacks
          if (!error && state !== oauthState) {
            res.writeHead(400, { 'Content-Type': 'text/html' })
            res.end(
              `<h1>Authentication Error</h1><p>Invalid state parameter. Please try again.</p><p>You can close this window.</p>`,
            )
            cleanup()
            rejectOnce(new Error('OAuth state mismatch - possible CSRF attack'))
            return
          }

          if (error) {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            // Sanitize error messages to prevent XSS
            const sanitizedError = xss(String(error))
            const sanitizedErrorDescription = errorDescription
              ? xss(String(errorDescription))
              : ''
            res.end(
              `<h1>Authentication Error</h1><p>${sanitizedError}: ${sanitizedErrorDescription}</p><p>You can close this window.</p>`,
            )
            cleanup()
            let errorMessage = `OAuth error: ${error}`
            if (errorDescription) {
              errorMessage += ` - ${errorDescription}`
            }
            if (errorUri) {
              errorMessage += ` (See: ${errorUri})`
            }
            rejectOnce(new Error(errorMessage))
            return
          }

          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(
              `<h1>Authentication Successful</h1><p>You can close this window. Return to Claude Code.</p>`,
            )
            cleanup()
            resolveOnce(code)
          }
        }
      })

      server.on('error', (err: NodeJS.ErrnoException) => {
        cleanup()
        if (err.code === 'EADDRINUSE') {
          const findCmd =
            getPlatform() === 'windows'
              ? `netstat -ano | findstr :${port}`
              : `lsof -ti:${port} -sTCP:LISTEN`
          rejectOnce(
            new Error(
              `OAuth callback port ${port} is already in use — another process may be holding it. ` +
                `Run \`${findCmd}\` to find it.`,
            ),
          )
        } else {
          rejectOnce(new Error(`OAuth callback server failed: ${err.message}`))
        }
      })

      server.listen(port, '127.0.0.1', async () => {
        try {
          logMCPDebug(serverName, `Starting SDK auth`)
          logMCPDebug(serverName, `Server URL: ${serverConfig.url}`)

          // First call to start the auth flow - should redirect
          // Pass the scope and resource_metadata from WWW-Authenticate header if available
          const result = await sdkAuth(provider, {
            serverUrl: serverConfig.url,
            scope: wwwAuthParams.scope,
            resourceMetadataUrl: wwwAuthParams.resourceMetadataUrl,
          })
          logMCPDebug(serverName, `Initial auth result: ${result}`)

          if (result !== 'REDIRECT') {
            logMCPDebug(
              serverName,
              `Unexpected auth result, expected REDIRECT: ${result}`,
            )
          }
        } catch (error) {
          logMCPDebug(serverName, `SDK auth error: ${error}`)
          cleanup()
          rejectOnce(new Error(`SDK auth failed: ${errorMessage(error)}`))
        }
      })

      // Don't let the callback server or timeout pin the event loop — if the UI
      // component unmounts without aborting (e.g. parent intercepts Esc), we'd
      // rather let the process exit than stay alive for 5 minutes holding the
      // port. The abortSignal is the intended lifecycle management.
      server.unref()

      timeoutId = setTimeout(
        (cleanup, rejectOnce) => {
          cleanup()
          rejectOnce(new Error('Authentication timeout'))
        },
        5 * 60 * 1000, // 5 minutes
        cleanup,
        rejectOnce,
      )
      timeoutId.unref()
    })

    authorizationCodeObtained = true

    // Now complete the auth flow with the received code
    logMCPDebug(serverName, `Completing auth flow with authorization code`)
    const result = await sdkAuth(provider, {
      serverUrl: serverConfig.url,
      authorizationCode,
      resourceMetadataUrl: wwwAuthParams.resourceMetadataUrl,
    })

    logMCPDebug(serverName, `Auth result: ${result}`)

    if (result === 'AUTHORIZED') {
      // Debug: Check if tokens were properly saved
      const savedTokens = await provider.tokens()
      logMCPDebug(
        serverName,
        `Tokens after auth: ${savedTokens ? 'Present' : 'Missing'}`,
      )
      if (savedTokens) {
        logMCPDebug(
          serverName,
          `Token access_token length: ${savedTokens.access_token?.length}`,
        )
        logMCPDebug(serverName, `Token expires_in: ${savedTokens.expires_in}`)
      }

      logEvent('tengu_mcp_oauth_flow_success', {
        flowAttemptId:
          flowAttemptId as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        transportType:
          serverConfig.type as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        ...(getLoggingSafeMcpBaseUrl(serverConfig)
          ? {
              mcpServerBaseUrl: getLoggingSafeMcpBaseUrl(
                serverConfig,
              ) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
            }
          : {}),
      })
    } else {
      throw new Error('Unexpected auth result: ' + result)
    }
  } catch (error) {
    logMCPDebug(serverName, `Error during auth completion: ${error}`)

    // Determine failure reason for attribution telemetry. The try block covers
    // port acquisition, the callback server, the redirect flow, and token
    // exchange. Map known failure paths to stable reason codes.
    let reason: MCPOAuthFlowErrorReason = 'unknown'
    let oauthErrorCode: string | undefined
    let httpStatus: number | undefined

    if (error instanceof AuthenticationCancelledError) {
      reason = 'cancelled'
    } else if (authorizationCodeObtained) {
      reason = 'token_exchange_failed'
    } else {
      const msg = errorMessage(error)
      if (msg.includes('Authentication timeout')) {
        reason = 'timeout'
      } else if (msg.includes('OAuth state mismatch')) {
        reason = 'state_mismatch'
      } else if (msg.includes('OAuth error:')) {
        reason = 'provider_denied'
      } else if (
        msg.includes('already in use') ||
        msg.includes('EADDRINUSE') ||
        msg.includes('callback server failed') ||
        msg.includes('No available port')
      ) {
        reason = 'port_unavailable'
      } else if (msg.includes('SDK auth failed')) {
        reason = 'sdk_auth_failed'
      }
    }

    // sdkAuth uses native fetch and throws OAuthError subclasses (InvalidGrantError,
    // ServerError, InvalidClientError, etc.) via parseErrorResponse. Extract the
    // OAuth error code directly from the SDK error instance.
    if (error instanceof OAuthError) {
      oauthErrorCode = error.errorCode
      // SDK does not attach HTTP status as a property, but the fallback ServerError
      // embeds it in the message as "HTTP {status}:" when the response body was
      // unparseable. Best-effort extraction.
      const statusMatch = error.message.match(/^HTTP (\d{3}):/)
      if (statusMatch) {
        httpStatus = Number(statusMatch[1])
      }
      // If client not found, clear the stored client ID and suggest retry
      if (
        error.errorCode === 'invalid_client' &&
        error.message.includes('Client not found')
      ) {
        const storage = getSecureStorage()
        const existingData = storage.read() || {}
        const serverKey = getServerKey(serverName, serverConfig)
        if (existingData.mcpOAuth?.[serverKey]) {
          delete existingData.mcpOAuth[serverKey].clientId
          delete existingData.mcpOAuth[serverKey].clientSecret
          storage.update(existingData)
        }
      }
    }

    logEvent('tengu_mcp_oauth_flow_error', {
      flowAttemptId:
        flowAttemptId as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      reason:
        reason as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      error_code:
        oauthErrorCode as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      http_status:
        httpStatus?.toString() as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      transportType:
        serverConfig.type as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      ...(getLoggingSafeMcpBaseUrl(serverConfig)
        ? {
            mcpServerBaseUrl: getLoggingSafeMcpBaseUrl(
              serverConfig,
            ) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          }
        : {}),
    })
    throw error
  }
}

/**
 * Wraps fetch to detect 403 insufficient_scope responses and mark step-up
 * pending on the provider BEFORE the SDK's 403 handler calls auth(). Without
 * this, the SDK's authInternal sees refresh_token → refreshes (uselessly, since
 * RFC 6749 §6 forbids scope elevation via refresh) → returns 'AUTHORIZED' →
 * retry → 403 again → aborts with "Server returned 403 after trying upscoping",
 * never reaching redirectToAuthorization where step-up scope is persisted.
 * With this flag set, tokens() omits refresh_token so the SDK falls through
 * to the PKCE flow. See github.com/anthropics/claude-code/issues/28258.
 */
export function wrapFetchWithStepUpDetection(
  baseFetch: FetchLike,
  provider: ClaudeAuthProvider,
): FetchLike {
  return async (url, init) => {
    const response = await baseFetch(url, init)
    if (response.status === 403) {
      const wwwAuth = response.headers.get('WWW-Authenticate')
      if (wwwAuth?.includes('insufficient_scope')) {
        // Match both quoted and unquoted values (RFC 6750 §3 allows either).
        // Same pattern as the SDK's extractFieldFromWwwAuth.
        const match = wwwAuth.match(/scope=(?:"([^"]+)"|([^\s,]+))/)
        const scope = match?.[1] ?? match?.[2]
        if (scope) {
          provider.markStepUpPending(scope)
        }
      }
    }
    return response
  }
}

export class ClaudeAuthProvider implements OAuthClientProvider {
  private serverName: string
  private serverConfig: McpSSEServerConfig | McpHTTPServerConfig
  private redirectUri: string
  private handleRedirection: boolean
  private _codeVerifier?: string
  private _authorizationUrl?: string
  private _state?: string
  private _scopes?: string
  private _metadata?: Awaited<
    ReturnType<typeof discoverAuthorizationServerMetadata>
  >
  private _refreshInProgress?: Promise<OAuthTokens | undefined>
  private _pendingStepUpScope?: string
  private onAuthorizationUrlCallback?: (url: string) => void
  private skipBrowserOpen: boolean

  constructor(
    serverName: string,
    serverConfig: McpSSEServerConfig | McpHTTPServerConfig,
    redirectUri: string = buildRedirectUri(),
    handleRedirection = false,
    onAuthorizationUrl?: (url: string) => void,
    skipBrowserOpen?: boolean,
  ) {
    this.serverName = serverName
    this.serverConfig = serverConfig
    this.redirectUri = redirectUri
    this.handleRedirection = handleRedirection
    this.onAuthorizationUrlCallback = onAuthorizationUrl
    this.skipBrowserOpen = skipBrowserOpen ?? false
  }

  get redirectUrl(): string {
    return this.redirectUri
  }

  get authorizationUrl(): string | undefined {
    return this._authorizationUrl
  }

  get clientMetadata(): OAuthClientMetadata {
    const metadata: OAuthClientMetadata = {
      client_name: `Claude Code (${this.serverName})`,
      redirect_uris: [this.redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none', // Public client
    }

    // Include scope from metadata if available
    const metadataScope = getScopeFromMetadata(this._metadata)
    if (metadataScope) {
      metadata.scope = metadataScope
      logMCPDebug(
        this.serverName,
        `Using scope from metadata: ${metadata.scope}`,
      )
    }

    return metadata
  }

  /**
   * CIMD (SEP-991): URL-based client_id. When the auth server advertises
   * client_id_metadata_document_supported: true, the SDK uses this URL as the
   * client_id instead of performing Dynamic Client Registration.
   * Override via MCP_OAUTH_CLIENT_METADATA_URL env var (e.g. for testing, FedStart).
   */
  get clientMetadataUrl(): string | undefined {
    const override = process.env.MCP_OAUTH_CLIENT_METADATA_URL
    if (override) {
      logMCPDebug(this.serverName, `Using CIMD URL from env: ${override}`)
      return override
    }
    return MCP_CLIENT_METADATA_URL
  }

  setMetadata(
    metadata: Awaited<ReturnType<typeof discoverAuthorizationServerMetadata>>,
  ): void {
    this._metadata = metadata
  }

  /**
   * Called by the fetch wrapper when a 403 insufficient_scope response is
   * detected. Setting this causes tokens() to omit refresh_token, forcing
   * the SDK's authInternal to skip its (useless) refresh path and fall through
   * to startAuthorization → redirectToAuthorization → step-up persistence.
   * RFC 6749 §6 forbids scope elevation via refresh, so refreshing would just
   * return the same-scoped token and the retry would 403 again.
   */
  markStepUpPending(scope: string): void {
    this._pendingStepUpScope = scope
    logMCPDebug(this.serverName, `Marked step-up pending: ${scope}`)
  }

  async state(): Promise<string> {
    // Generate state if not already generated for this instance
    if (!this._state) {
      this._state = randomBytes(32).toString('base64url')
      logMCPDebug(this.serverName, 'Generated new OAuth state')
    }
    return this._state
  }

  async clientInformation(): Promise<OAuthClientInformation | undefined> {
    const storage = getSecureStorage()
    const data = storage.read()
    const serverKey = getServerKey(this.serverName, this.serverConfig)

    // Check session credentials first (from DCR or previous auth)
    const storedInfo = data?.mcpOAuth?.[serverKey]
    if (storedInfo?.clientId) {
      logMCPDebug(this.serverName, `Found client info`)
      return {
        client_id: storedInfo.clientId,
        client_secret: storedInfo.clientSecret,
      }
    }

    // Fallback: pre-configured client ID from server config
    const configClientId = this.serverConfig.oauth?.clientId
    if (configClientId) {
      const clientConfig = data?.mcpOAuthClientConfig?.[serverKey]
      logMCPDebug(this.serverName, `Using pre-configured client ID`)
      return {
        client_id: configClientId,
        client_secret: clientConfig?.clientSecret,
      }
    }

    // If we don't have stored client info, return undefined to trigger registration
    logMCPDebug(this.serverName, `No client info found`)
    return undefined
  }

  async saveClientInformation(
    clientInformation: OAuthClientInformationFull,
  ): Promise<void> {
    const storage = getSecureStorage()
    const existingData = storage.read() || {}
    const serverKey = getServerKey(this.serverName, this.serverConfig)

    const updatedData: SecureStorageData = {
      ...existingData,
      mcpOAuth: {
        ...existingData.mcpOAuth,
        [serverKey]: {
          ...existingData.mcpOAuth?.[serverKey],
          serverName: this.serverName,
          serverUrl: this.serverConfig.url,
          clientId: clientInformation.client_id,
          clientSecret: clientInformation.client_secret,
          // Provide default values for required fields if not present
          accessToken: existingData.mcpOAuth?.[serverKey]?.accessToken || '',
          expiresAt: existingData.mcpOAuth?.[serverKey]?.expiresAt || 0,
        },
      },
    }

    storage.update(updatedData)
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    // Cross-process token changes (another CC instance refreshed or invalidated)
    // are picked up via the keychain cache TTL (see macOsKeychainStorage.ts).
    // In-process writes already invalidate the cache via storage.update().
    // We do NOT clearKeychainCache() here — tokens() is called by the MCP SDK's
    // _commonHeaders on every request, and forcing a cache miss would trigger
    // a blocking spawnSync(`security find-generic-password`) 30-40x/sec.
    // See CPU profile: spawnSync was 7.2% of total CPU after PR #19436.
    const storage = getSecureStorage()
    const data = await storage.readAsync()
    const serverKey = getServerKey(this.serverName, this.serverConfig)

    const tokenData = data?.mcpOAuth?.[serverKey]

    // XAA: a cached id_token plays the same UX role as a refresh_token — run
    // the silent exchange to get a fresh access_token without a browser. The
    // id_token does expire (we re-acquire via `xaa login` when it does); the
    // point is that while it's valid, re-auth is zero-interaction.
    //
    // Only fire when we don't have a refresh_token. If the AS returned one,
    // the normal refresh path (below) is cheaper — 1 request vs the 4-request
    // XAA chain. If that refresh is revoked, refreshAuthorization() clears it
    // (invalidateCredentials('tokens')), and the next tokens() falls through
    // to here.
    //
    // Fires on:
    //   - never authed (!tokenData)                 → first connect, auto-auth
    //   - SDK partial write {accessToken:''}        → stale from past session
    //   - expired/expiring, no refresh_token        → proactive XAA re-auth
    //
    // No special-casing of {accessToken:'', expiresAt:0}. Yes, SDK auth()
    // writes that mid-flow (saveClientInformation defaults). But with this
    // auto-auth branch, the *first* tokens() call — before auth() writes
    // anything — fires xaaRefresh. If id_token is cached, SDK short-circuits
    // there and never reaches the write. If id_token isn't cached, xaaRefresh
    // returns undefined in ~1 keychain read, auth() proceeds, writes the
    // marker, calls tokens() again, xaaRefresh fails again identically.
    // Harmless redundancy, not a wasted exchange. And guarding on `!==''`
    // permanently bricks auto-auth when a *prior* session left that marker
    // in keychain — real bug seen with xaa.dev.
    //
    // xaaRefresh() internally short-circuits to undefined when the id_token
    // isn't cached (or settings.xaaIdp is gone) → we fall through to the
    // existing needs-auth path → user runs `xaa login`.
    //
    if (
      isXaaEnabled() &&
      this.serverConfig.oauth?.xaa &&
      !tokenData?.refreshToken &&
      (!tokenData?.accessToken ||
        (tokenData.expiresAt - Date.now()) / 1000 <= 300)
    ) {
      if (!this._refreshInProgress) {
        logMCPDebug(
          this.serverName,
          tokenData
            ? `XAA: access_token expiring, attempting silent exchange`
            : `XAA: no access_token yet, attempting silent exchange`,
        )
        this._refreshInProgress = this.xaaRefresh().finally(() => {
          this._refreshInProgress = undefined
        })
      }
      try {
        const refreshed = await this._refreshInProgress
        if (refreshed) return refreshed
      } catch (e) {
        logMCPDebug(
          this.serverName,
          `XAA silent exchange failed: ${errorMessage(e)}`,
        )
      }
      // Fall through. Either id_token isn't cached (xaaRefresh returned
      // undefined) or the exchange errored. Normal path below handles both:
      // !tokenData → undefined → 401 → needs-auth; expired → undefined → same.
    }

    if (!tokenData) {
      logMCPDebug(this.serverName, `No token data found`)
      return undefined
    }

    // Check if token is expired
    const expiresIn = (tokenData.expiresAt - Date.now()) / 1000

    // Step-up check: if a 403 insufficient_scope was detected and the current
    // token doesn't have the requested scope, omit refresh_token below so the
    // SDK skips refresh and falls through to the PKCE flow.
    const currentScopes = tokenData.scope?.split(' ') ?? []
    const needsStepUp =
      this._pendingStepUpScope !== undefined &&
      this._pendingStepUpScope.split(' ').some(s => !currentScopes.includes(s))
    if (needsStepUp) {
      logMCPDebug(
        this.serverName,
        `Step-up pending (${this._pendingStepUpScope}), omitting refresh_token`,
      )
    }

    // If token is expired and we don't have a refresh token, return undefined
    if (expiresIn <= 0 && !tokenData.refreshToken) {
      logMCPDebug(this.serverName, `Token expired without refresh token`)
      return undefined
    }

    // If token is expired or about to expire (within 5 minutes) and we have a refresh token, refresh it proactively.
    // This proactive refresh is a UX improvement - it avoids the latency of a failed request followed by token refresh.
    // While MCP servers should return 401 for expired tokens (which triggers SDK-level refresh), proactively refreshing
    // before expiry provides a smoother user experience.
    // Skip when step-up is pending — refreshing can't elevate scope (RFC 6749 §6).
    if (expiresIn <= 300 && tokenData.refreshToken && !needsStepUp) {
      // Reuse existing refresh promise if one is in progress to prevent concurrent refreshes
      if (!this._refreshInProgress) {
        logMCPDebug(
          this.serverName,
          `Token expires in ${Math.floor(expiresIn)}s, attempting proactive refresh`,
        )
        this._refreshInProgress = this.refreshAuthorization(
          tokenData.refreshToken,
        ).finally(() => {
          this._refreshInProgress = undefined
        })
      } else {
        logMCPDebug(
          this.serverName,
          `Token refresh already in progress, reusing existing promise`,
        )
      }

      try {
        const refreshed = await this._refreshInProgress
        if (refreshed) {
          logMCPDebug(this.serverName, `Token refreshed successfully`)
          return refreshed
        }
        logMCPDebug(
          this.serverName,
          `Token refresh failed, returning current tokens`,
        )
      } catch (error) {
        logMCPDebug(
          this.serverName,
          `Token refresh error: ${errorMessage(error)}`,
        )
      }
    }

    // Return current tokens (may be expired if refresh failed or not needed yet)
    const tokens = {
      access_token: tokenData.accessToken,
      refresh_token: needsStepUp ? undefined : tokenData.refreshToken,
      expires_in: expiresIn,
      scope: tokenData.scope,
      token_type: 'Bearer',
    }

    logMCPDebug(this.serverName, `Returning tokens`)
    logMCPDebug(this.serverName, `Token length: ${tokens.access_token?.length}`)
    logMCPDebug(this.serverName, `Has refresh token: ${!!tokens.refresh_token}`)
    logMCPDebug(this.serverName, `Expires in: ${Math.floor(expiresIn)}s`)

    return tokens
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    this._pendingStepUpScope = undefined
    const storage = getSecureStorage()
    const existingData = storage.read() || {}
    const serverKey = getServerKey(this.serverName, this.serverConfig)

    logMCPDebug(this.serverName, `Saving tokens`)
    logMCPDebug(this.serverName, `Token expires in: ${tokens.expires_in}`)
    logMCPDebug(this.serverName, `Has refresh token: ${!!tokens.refresh_token}`)

    const updatedData: SecureStorageData = {
      ...existingData,
      mcpOAuth: {
        ...existingData.mcpOAuth,
        [serverKey]: {
          ...existingData.mcpOAuth?.[serverKey],
          serverName: this.serverName,
          serverUrl: this.serverConfig.url,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
          scope: tokens.scope,
        },
      },
    }

    storage.update(updatedData)
  }

  /**
   * XAA silent refresh: cached id_token → Layer-2 exchange → new access_token.
   * No browser.
   *
   * Returns undefined if the id_token is gone from cache — caller treats this
   * as needs-interactive-reauth (transport will 401, CC surfaces it).
   *
   * On exchange failure, clears the id_token cache so the next interactive
   * auth does a fresh IdP login (the cached id_token is likely stale/revoked).
   *
   * TODO(xaa-ga): add cross-process lockfile before GA. `_refreshInProgress`
   * only dedupes within one process — two CC instances with expiring tokens
   * both fire the full 4-request XAA chain and race on storage.update().
   * Unlike inc-4829 the id_token is not single-use so both access_tokens
   * stay valid (wasted round-trips + keychain write race, not brickage),
   * but this is the shape CLAUDE.md flags under "Token/auth caching across
   * process boundaries". Mirror refreshAuthorization()'s lockfile pattern.
   */
  private async xaaRefresh(): Promise<OAuthTokens | undefined> {
    const idp = getXaaIdpSettings()
    if (!idp) return undefined // config was removed mid-session

    const idToken = getCachedIdpIdToken(idp.issuer)
    if (!idToken) {
      logMCPDebug(
        this.serverName,
        'XAA: id_token not cached, needs interactive re-auth',
      )
      return undefined
    }

    const clientId = this.serverConfig.oauth?.clientId
    const clientConfig = getMcpClientConfig(this.serverName, this.serverConfig)
    if (!clientId || !clientConfig?.clientSecret) {
      logMCPDebug(
        this.serverName,
        'XAA: missing clientId or clientSecret in config — skipping silent refresh',
      )
      return undefined // shouldn't happen if `mcp add` was correct
    }

    const idpClientSecret = getIdpClientSecret(idp.issuer)

    // Discover IdP token endpoint. Could cache (fetchCache.ts already
    // caches /.well-known/ requests), but OIDC metadata is cheap + idempotent.
    // xaaRefresh is the silent tokens() path — soft-fail to undefined so the
    // caller falls through to needs-authentication instead of throwing mid-connect.
    let oidc
    try {
      oidc = await discoverOidc(idp.issuer)
    } catch (e) {
      logMCPDebug(
        this.serverName,
        `XAA: OIDC discovery failed in silent refresh: ${errorMessage(e)}`,
      )
      return undefined
    }

    try {
      const tokens = await performCrossAppAccess(
        this.serverConfig.url,
        {
          clientId,
          clientSecret: clientConfig.clientSecret,
          idpClientId: idp.clientId,
          idpClientSecret,
          idpIdToken: idToken,
          idpTokenEndpoint: oidc.token_endpoint,
        },
        this.serverName,
      )
      // Write directly (not via saveTokens) so clientId + clientSecret land in
      // storage even when this is the first write for serverKey. saveTokens
      // only spreads existing data; if no prior performMCPXaaAuth ran,
      // revokeServerTokens would later read tokenData.clientId as undefined
      // and send a client_id-less RFC 7009 request that strict ASes reject.
      const storage = getSecureStorage()
      const existingData = storage.read() || {}
      const serverKey = getServerKey(this.serverName, this.serverConfig)
      const prev = existingData.mcpOAuth?.[serverKey]
      storage.update({
        ...existingData,
        mcpOAuth: {
          ...existingData.mcpOAuth,
          [serverKey]: {
            ...prev,
            serverName: this.serverName,
            serverUrl: this.serverConfig.url,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token ?? prev?.refreshToken,
            expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
            scope: tokens.scope,
            clientId,
            clientSecret: clientConfig.clientSecret,
            discoveryState: {
              authorizationServerUrl: tokens.authorizationServerUrl,
            },
          },
        },
      })
      return {
        access_token: tokens.access_token,
        token_type: 'Bearer',
        expires_in: tokens.expires_in,
        scope: tokens.scope,
        refresh_token: tokens.refresh_token,
      }
    } catch (e) {
      if (e instanceof XaaTokenExchangeError && e.shouldClearIdToken) {
        clearIdpIdToken(idp.issuer)
        logMCPDebug(
          this.serverName,
          'XAA: cleared id_token after exchange failure',
        )
      }
      throw e
    }
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    // Store the authorization URL
    this._authorizationUrl = authorizationUrl.toString()

    // Extract and store scopes from the authorization URL for later use in token exchange
    const scopes = authorizationUrl.searchParams.get('scope')
    logMCPDebug(
      this.serverName,
      `Authorization URL: ${redactSensitiveUrlParams(authorizationUrl.toString())}`,
    )
    logMCPDebug(this.serverName, `Scopes in URL: ${scopes || 'NOT FOUND'}`)

    if (scopes) {
      this._scopes = scopes
      logMCPDebug(
        this.serverName,
        `Captured scopes from authorization URL: ${scopes}`,
      )
    } else {
      // If no scope in URL, try to get it from metadata
      const metadataScope = getScopeFromMetadata(this._metadata)
      if (metadataScope) {
        this._scopes = metadataScope
        logMCPDebug(
          this.serverName,
          `Using scopes from metadata: ${metadataScope}`,
        )
      } else {
        logMCPDebug(this.serverName, `No scopes available from URL or metadata`)
      }
    }

    // Persist scope for step-up auth: only when the transport-attached provider
    // (handleRedirection=false) receives a step-up 401. The SDK calls auth()
    // which calls redirectToAuthorization with the new scope. We persist it
    // so the next performMCPOAuthFlow can use it without an extra probe request.
    // Guard with !handleRedirection to avoid persisting during normal auth flows
    // (where the scope may come from metadata scopes_supported rather than a 401).
    if (this._scopes && !this.handleRedirection) {
      const storage = getSecureStorage()
      const existingData = storage.read() || {}
      const serverKey = getServerKey(this.serverName, this.serverConfig)
      const existing = existingData.mcpOAuth?.[serverKey]
      if (existing) {
        existing.stepUpScope = this._scopes
        storage.update(existingData)
        logMCPDebug(this.serverName, `Persisted step-up scope: ${this._scopes}`)
      }
    }

    if (!this.handleRedirection) {
      logMCPDebug(
        this.serverName,
        `Redirection handling is disabled, skipping redirect`,
      )
      return
    }

    // Validate URL scheme for security
    const urlString = authorizationUrl.toString()
    if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
      throw new Error(
        'Invalid authorization URL: must use http:// or https:// scheme',
      )
    }

    logMCPDebug(this.serverName, `Redirecting to authorization URL`)
    const redactedUrl = redactSensitiveUrlParams(urlString)
    logMCPDebug(this.serverName, `Authorization URL: ${redactedUrl}`)

    // Notify the UI about the authorization URL BEFORE opening the browser,
    // so users can see the URL as a fallback if the browser fails to open
    if (this.onAuthorizationUrlCallback) {
      this.onAuthorizationUrlCallback(urlString)
    }

    if (!this.skipBrowserOpen) {
      logMCPDebug(this.serverName, `Opening authorization URL: ${redactedUrl}`)

      const success = await openBrowser(urlString)
      if (!success) {
        logMCPDebug(
          this.serverName,
          `Browser didn't open automatically. URL is shown in UI.`,
        )
      }
    } else {
      logMCPDebug(
        this.serverName,
        `Skipping browser open (skipBrowserOpen=true). URL: ${redactedUrl}`,
      )
    }
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    logMCPDebug(this.serverName, `Saving code verifier`)
    this._codeVerifier = codeVerifier
  }

  async codeVerifier(): Promise<string> {
    if (!this._codeVerifier) {
      logMCPDebug(this.serverName, `No code verifier saved`)
      throw new Error('No code verifier saved')
    }
    logMCPDebug(this.serverName, `Returning code verifier`)
    return this._codeVerifier
  }

  async invalidateCredentials(
    scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery',
  ): Promise<void> {
    const storage = getSecureStorage()
    const existingData = storage.read()
    if (!existingData?.mcpOAuth) return

    const serverKey = getServerKey(this.serverName, this.serverConfig)
    const tokenData = existingData.mcpOAuth[serverKey]
    if (!tokenData) return

    switch (scope) {
      case 'all':
        delete existingData.mcpOAuth[serverKey]
        break
      case 'client':
        tokenData.clientId = undefined
        tokenData.clientSecret = undefined
        break
      case 'tokens':
        tokenData.accessToken = ''
        tokenData.refreshToken = undefined
        tokenData.expiresAt = 0
        break
      case 'verifier':
        this._codeVerifier = undefined
        return
      case 'discovery':
        tokenData.discoveryState = undefined
        tokenData.stepUpScope = undefined
        break
    }

    storage.update(existingData)
    logMCPDebug(this.serverName, `Invalidated credentials (scope: ${scope})`)
  }

  async saveDiscoveryState(state: OAuthDiscoveryState): Promise<void> {
    const storage = getSecureStorage()
    const existingData = storage.read() || {}
    const serverKey = getServerKey(this.serverName, this.serverConfig)

    logMCPDebug(
      this.serverName,
      `Saving discovery state (authServer: ${state.authorizationServerUrl})`,
    )

    // Persist only the URLs, NOT the full metadata blobs.
    // authorizationServerMetadata alone is ~1.5-2KB per MCP server (every
    // grant type, PKCE method, endpoint the IdP supports). On macOS the
    // keychain write goes through `security -i` which has a 4096-byte stdin
    // line limit — with hex encoding that's ~2013 bytes of JSON total. Two
    // OAuth MCP servers persisting full metadata overflows it, corrupting
    // the credential store (#30337). The SDK re-fetches missing metadata
    // with one HTTP GET on the next auth — see node_modules/.../auth.js
    // `cachedState.authorizationServerMetadata ?? await discover...`.
    const updatedData: SecureStorageData = {
      ...existingData,
      mcpOAuth: {
        ...existingData.mcpOAuth,
        [serverKey]: {
          ...existingData.mcpOAuth?.[serverKey],
          serverName: this.serverName,
          serverUrl: this.serverConfig.url,
          accessToken: existingData.mcpOAuth?.[serverKey]?.accessToken || '',
          expiresAt: existingData.mcpOAuth?.[serverKey]?.expiresAt || 0,
          discoveryState: {
            authorizationServerUrl: state.authorizationServerUrl,
            resourceMetadataUrl: state.resourceMetadataUrl,
          },
        },
      },
    }

    storage.update(updatedData)
  }

  async discoveryState(): Promise<OAuthDiscoveryState | undefined> {
    const storage = getSecureStorage()
    const data = storage.read()
    const serverKey = getServerKey(this.serverName, this.serverConfig)

    const cached = data?.mcpOAuth?.[serverKey]?.discoveryState
    if (cached?.authorizationServerUrl) {
      logMCPDebug(
        this.serverName,
        `Returning cached discovery state (authServer: ${cached.authorizationServerUrl})`,
      )

      return {
        authorizationServerUrl: cached.authorizationServerUrl,
        resourceMetadataUrl: cached.resourceMetadataUrl,
        resourceMetadata:
          cached.resourceMetadata as OAuthDiscoveryState['resourceMetadata'],
        authorizationServerMetadata:
          cached.authorizationServerMetadata as OAuthDiscoveryState['authorizationServerMetadata'],
      }
    }

    // Check config hint for direct metadata URL
    const metadataUrl = this.serverConfig.oauth?.authServerMetadataUrl
    if (metadataUrl) {
      logMCPDebug(
        this.serverName,
        `Fetching metadata from configured URL: ${metadataUrl}`,
      )
      try {
        const metadata = await fetchAuthServerMetadata(
          this.serverName,
          this.serverConfig.url,
          metadataUrl,
        )
        if (metadata) {
          return {
            authorizationServerUrl: metadata.issuer,
            authorizationServerMetadata:
              metadata as OAuthDiscoveryState['authorizationServerMetadata'],
          }
        }
      } catch (error) {
        logMCPDebug(
          this.serverName,
          `Failed to fetch from configured metadata URL: ${errorMessage(error)}`,
        )
      }
    }

    return undefined
  }

  async refreshAuthorization(
    refreshToken: string,
  ): Promise<OAuthTokens | undefined> {
    const serverKey = getServerKey(this.serverName, this.serverConfig)
    const claudeDir = getClaudeConfigHomeDir()
    await mkdir(claudeDir, { recursive: true })
    const sanitizedKey = serverKey.replace(/[^a-zA-Z0-9]/g, '_')
    const lockfilePath = join(claudeDir, `mcp-refresh-${sanitizedKey}.lock`)

    let release: (() => Promise<void>) | undefined
    for (let retry = 0; retry < MAX_LOCK_RETRIES; retry++) {
      try {
        logMCPDebug(
          this.serverName,
          `Acquiring refresh lock (attempt ${retry + 1})`,
        )
        release = await lockfile.lock(lockfilePath, {
          realpath: false,
          onCompromised: () => {
            logMCPDebug(this.serverName, `Refresh lock was compromised`)
          },
        })
        logMCPDebug(this.serverName, `Acquired refresh lock`)
        break
      } catch (e: unknown) {
        const code = getErrnoCode(e)
        if (code === 'ELOCKED') {
          logMCPDebug(
            this.serverName,
            `Refresh lock held by another process, waiting (attempt ${retry + 1}/${MAX_LOCK_RETRIES})`,
          )
          await sleep(1000 + Math.random() * 1000)
          continue
        }
        logMCPDebug(
          this.serverName,
          `Failed to acquire refresh lock: ${code}, proceeding without lock`,
        )
        break
      }
    }
    if (!release) {
      logMCPDebug(
        this.serverName,
        `Could not acquire refresh lock after ${MAX_LOCK_RETRIES} retries, proceeding without lock`,
      )
    }

    try {
      // Re-read tokens after acquiring lock — another process may have refreshed
      clearKeychainCache()
      const storage = getSecureStorage()
      const data = storage.read()
      const tokenData = data?.mcpOAuth?.[serverKey]
      if (tokenData) {
        const expiresIn = (tokenData.expiresAt - Date.now()) / 1000
        if (expiresIn > 300) {
          logMCPDebug(
            this.serverName,
            `Another process already refreshed tokens (expires in ${Math.floor(expiresIn)}s)`,
          )
          return {
            access_token: tokenData.accessToken,
            refresh_token: tokenData.refreshToken,
            expires_in: expiresIn,
            scope: tokenData.scope,
            token_type: 'Bearer',
          }
        }
        // Use the freshest refresh token from storage
        if (tokenData.refreshToken) {
          refreshToken = tokenData.refreshToken
        }
      }
      return await this._doRefresh(refreshToken)
    } finally {
      if (release) {
        try {
          await release()
          logMCPDebug(this.serverName, `Released refresh lock`)
        } catch {
          logMCPDebug(this.serverName, `Failed to release refresh lock`)
        }
      }
    }
  }

  private async _doRefresh(
    refreshToken: string,
  ): Promise<OAuthTokens | undefined> {
    const MAX_ATTEMPTS = 3

    const mcpServerBaseUrl = getLoggingSafeMcpBaseUrl(this.serverConfig)
    const emitRefreshEvent = (
      outcome: 'success' | 'failure',
      reason?: MCPRefreshFailureReason,
    ): void => {
      logEvent(
        outcome === 'success'
          ? 'tengu_mcp_oauth_refresh_success'
          : 'tengu_mcp_oauth_refresh_failure',
        {
          transportType: this.serverConfig
            .type as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          ...(mcpServerBaseUrl
            ? {
                mcpServerBaseUrl:
                  mcpServerBaseUrl as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
              }
            : {}),
          ...(reason
            ? {
                reason:
                  reason as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
              }
            : {}),
        },
      )
    }

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        logMCPDebug(this.serverName, `Starting token refresh`)
        const authFetch = createAuthFetch()

        // Reuse cached metadata from the initial OAuth flow if available,
        // since metadata (token endpoint URL, etc.) is static per auth server.
        // Priority:
        // 1. In-memory cache (same-session refreshes)
        // 2. Persisted discovery state from initial auth (cross-session) —
        //    avoids re-running RFC 9728 discovery on every refresh.
        // 3. Full RFC 9728 → RFC 8414 re-discovery via fetchAuthServerMetadata.
        let metadata = this._metadata
        if (!metadata) {
          const cached = await this.discoveryState()
          if (cached?.authorizationServerMetadata) {
            logMCPDebug(
              this.serverName,
              `Using persisted auth server metadata for refresh`,
            )
            metadata = cached.authorizationServerMetadata
          } else if (cached?.authorizationServerUrl) {
            logMCPDebug(
              this.serverName,
              `Re-discovering metadata from persisted auth server URL: ${cached.authorizationServerUrl}`,
            )
            metadata = await discoverAuthorizationServerMetadata(
              cached.authorizationServerUrl,
              { fetchFn: authFetch },
            )
          }
        }
        if (!metadata) {
          metadata = await fetchAuthServerMetadata(
            this.serverName,
            this.serverConfig.url,
            this.serverConfig.oauth?.authServerMetadataUrl,
            authFetch,
          )
        }
        if (!metadata) {
          logMCPDebug(this.serverName, `Failed to discover OAuth metadata`)
          emitRefreshEvent('failure', 'metadata_discovery_failed')
          return undefined
        }
        // Cache for future refreshes
        this._metadata = metadata

        const clientInfo = await this.clientInformation()
        if (!clientInfo) {
          logMCPDebug(this.serverName, `No client information available`)
          emitRefreshEvent('failure', 'no_client_info')
          return undefined
        }

        const newTokens = await sdkRefreshAuthorization(
          new URL(this.serverConfig.url),
          {
            metadata,
            clientInformation: clientInfo,
            refreshToken,
            resource: new URL(this.serverConfig.url),
            fetchFn: authFetch,
          },
        )

        if (newTokens) {
          logMCPDebug(this.serverName, `Token refresh successful`)
          await this.saveTokens(newTokens)
          emitRefreshEvent('success')
          return newTokens
        }

        logMCPDebug(this.serverName, `Token refresh returned no tokens`)
        emitRefreshEvent('failure', 'no_tokens_returned')
        return undefined
      } catch (error) {
        // Invalid grant means the refresh token itself is invalid/revoked/expired.
        // But another process may have already refreshed successfully — check first.
        if (error instanceof InvalidGrantError) {
          logMCPDebug(
            this.serverName,
            `Token refresh failed with invalid_grant: ${error.message}`,
          )
          clearKeychainCache()
          const storage = getSecureStorage()
          const data = storage.read()
          const serverKey = getServerKey(this.serverName, this.serverConfig)
          const tokenData = data?.mcpOAuth?.[serverKey]
          if (tokenData) {
            const expiresIn = (tokenData.expiresAt - Date.now()) / 1000
            if (expiresIn > 300) {
              logMCPDebug(
                this.serverName,
                `Another process refreshed tokens, using those`,
              )
              // Not emitted as success: this process did not perform a
              // refresh, and the winning process already emitted its own
              // success event. Emitting here would double-count.
              return {
                access_token: tokenData.accessToken,
                refresh_token: tokenData.refreshToken,
                expires_in: expiresIn,
                scope: tokenData.scope,
                token_type: 'Bearer',
              }
            }
          }
          logMCPDebug(
            this.serverName,
            `No valid tokens in storage, clearing stored tokens`,
          )
          await this.invalidateCredentials('tokens')
          emitRefreshEvent('failure', 'invalid_grant')
          return undefined
        }

        // Retry on timeouts or transient server errors
        const isTimeoutError =
          error instanceof Error &&
          /timeout|timed out|etimedout|econnreset/i.test(error.message)
        const isTransientServerError =
          error instanceof ServerError ||
          error instanceof TemporarilyUnavailableError ||
          error instanceof TooManyRequestsError
        const isRetryable = isTimeoutError || isTransientServerError

        if (!isRetryable || attempt >= MAX_ATTEMPTS) {
          logMCPDebug(
            this.serverName,
            `Token refresh failed: ${errorMessage(error)}`,
          )
          emitRefreshEvent(
            'failure',
            isRetryable ? 'transient_retries_exhausted' : 'request_failed',
          )
          return undefined
        }

        const delayMs = 1000 * Math.pow(2, attempt - 1) // 1s, 2s, 4s
        logMCPDebug(
          this.serverName,
          `Token refresh failed, retrying in ${delayMs}ms (attempt ${attempt}/${MAX_ATTEMPTS})`,
        )
        await sleep(delayMs)
      }
    }

    return undefined
  }
}

export async function readClientSecret(): Promise<string> {
  const envSecret = process.env.MCP_CLIENT_SECRET
  if (envSecret) {
    return envSecret
  }

  if (!process.stdin.isTTY) {
    throw new Error(
      'No TTY available to prompt for client secret. Set MCP_CLIENT_SECRET env var instead.',
    )
  }

  return new Promise((resolve, reject) => {
    process.stderr.write('Enter OAuth client secret: ')
    process.stdin.setRawMode?.(true)
    let secret = ''
    const onData = (ch: Buffer) => {
      const c = ch.toString()
      if (c === '\n' || c === '\r') {
        process.stdin.setRawMode?.(false)
        process.stdin.removeListener('data', onData)
        process.stderr.write('\n')
        resolve(secret)
      } else if (c === '\u0003') {
        process.stdin.setRawMode?.(false)
        process.stdin.removeListener('data', onData)
        reject(new Error('Cancelled'))
      } else if (c === '\u007F' || c === '\b') {
        secret = secret.slice(0, -1)
      } else {
        secret += c
      }
    }
    process.stdin.on('data', onData)
  })
}

export function saveMcpClientSecret(
  serverName: string,
  serverConfig: McpSSEServerConfig | McpHTTPServerConfig,
  clientSecret: string,
): void {
  const storage = getSecureStorage()
  const existingData = storage.read() || {}
  const serverKey = getServerKey(serverName, serverConfig)
  storage.update({
    ...existingData,
    mcpOAuthClientConfig: {
      ...existingData.mcpOAuthClientConfig,
      [serverKey]: { clientSecret },
    },
  })
}

export function clearMcpClientConfig(
  serverName: string,
  serverConfig: McpSSEServerConfig | McpHTTPServerConfig,
): void {
  const storage = getSecureStorage()
  const existingData = storage.read()
  if (!existingData?.mcpOAuthClientConfig) return
  const serverKey = getServerKey(serverName, serverConfig)
  if (existingData.mcpOAuthClientConfig[serverKey]) {
    delete existingData.mcpOAuthClientConfig[serverKey]
    storage.update(existingData)
  }
}

export function getMcpClientConfig(
  serverName: string,
  serverConfig: McpSSEServerConfig | McpHTTPServerConfig,
): { clientSecret?: string } | undefined {
  const storage = getSecureStorage()
  const data = storage.read()
  const serverKey = getServerKey(serverName, serverConfig)
  return data?.mcpOAuthClientConfig?.[serverKey]
}

/**
 * Safely extracts scope information from AuthorizationServerMetadata.
 * The metadata can be either OAuthMetadata or OpenIdProviderDiscoveryMetadata,
 * and different providers use different fields for scope information.
 */
function getScopeFromMetadata(
  metadata: AuthorizationServerMetadata | undefined,
): string | undefined {
  if (!metadata) return undefined
  // Try 'scope' first (non-standard but used by some providers)
  if ('scope' in metadata && typeof metadata.scope === 'string') {
    return metadata.scope
  }
  // Try 'default_scope' (non-standard but used by some providers)
  if (
    'default_scope' in metadata &&
    typeof metadata.default_scope === 'string'
  ) {
    return metadata.default_scope
  }
  // Fall back to scopes_supported (standard OAuth 2.0 field)
  if (metadata.scopes_supported && Array.isArray(metadata.scopes_supported)) {
    return metadata.scopes_supported.join(' ')
  }
  return undefined
}
