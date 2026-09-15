/**
 * Cross-App Access (XAA) / Enterprise Managed Authorization (SEP-990)
 *
 * Obtains an MCP access token WITHOUT a browser consent screen by chaining:
 *   1. RFC 8693 Token Exchange at the IdP: id_token → ID-JAG
 *   2. RFC 7523 JWT Bearer Grant at the AS: ID-JAG → access_token
 *
 * Spec refs:
 *   - ID-JAG (IETF draft): https://datatracker.ietf.org/doc/draft-ietf-oauth-identity-assertion-authz-grant/
 *   - MCP ext-auth (SEP-990): https://github.com/modelcontextprotocol/ext-auth
 *   - RFC 8693 (Token Exchange), RFC 7523 (JWT Bearer), RFC 9728 (PRM)
 *
 * Reference impl: ~/code/mcp/conformance/examples/clients/typescript/everything-client.ts:375-522
 *
 * Structure: four Layer-2 ops (aligned with TS SDK PR #1593's Layer-2 shapes so
 * a future SDK swap is mechanical) + one Layer-3 orchestrator that composes them.
 */

import {
  discoverAuthorizationServerMetadata,
  discoverOAuthProtectedResourceMetadata,
} from '@modelcontextprotocol/sdk/client/auth.js'
import type { FetchLike } from '@modelcontextprotocol/sdk/shared/transport.js'
import { z } from 'zod/v4'
import { lazySchema } from '../../utils/lazySchema.js'
import { logMCPDebug } from '../../utils/log.js'
import { jsonStringify } from '../../utils/slowOperations.js'

const XAA_REQUEST_TIMEOUT_MS = 30000

const TOKEN_EXCHANGE_GRANT = 'urn:ietf:params:oauth:grant-type:token-exchange'
const JWT_BEARER_GRANT = 'urn:ietf:params:oauth:grant-type:jwt-bearer'
const ID_JAG_TOKEN_TYPE = 'urn:ietf:params:oauth:token-type:id-jag'
const ID_TOKEN_TYPE = 'urn:ietf:params:oauth:token-type:id_token'

/**
 * Creates a fetch wrapper that enforces the XAA request timeout and optionally
 * composes a caller-provided abort signal. Using AbortSignal.any ensures the
 * user's cancel (e.g. Esc in the auth menu) actually aborts in-flight requests
 * rather than being clobbered by the timeout signal.
 */
function makeXaaFetch(abortSignal?: AbortSignal): FetchLike {
  return (url, init) => {
    const timeout = AbortSignal.timeout(XAA_REQUEST_TIMEOUT_MS)
    const signal = abortSignal
      ? // eslint-disable-next-line eslint-plugin-n/no-unsupported-features/node-builtins
        AbortSignal.any([timeout, abortSignal])
      : timeout
    // eslint-disable-next-line eslint-plugin-n/no-unsupported-features/node-builtins
    return fetch(url, { ...init, signal })
  }
}

const defaultFetch = makeXaaFetch()

/**
 * RFC 8414 §3.3 / RFC 9728 §3.3 identifier comparison. Roundtrip through URL
 * to apply RFC 3986 §6.2.2 syntax-based normalization (lowercases scheme+host,
 * drops default port), then strip trailing slash.
 */
function normalizeUrl(url: string): string {
  try {
    return new URL(url).href.replace(/\/$/, '')
  } catch {
    return url.replace(/\/$/, '')
  }
}

/**
 * Thrown by requestJwtAuthorizationGrant when the IdP token-exchange leg
 * fails. Carries `shouldClearIdToken` so callers can decide whether to drop
 * the cached id_token based on OAuth error semantics (not substring matching):
 *   - 4xx / invalid_grant / invalid_token → id_token is bad, clear it
 *   - 5xx → IdP is down, id_token may still be valid, keep it
 *   - 200 with structurally-invalid body → protocol violation, clear it
 */
export class XaaTokenExchangeError extends Error {
  readonly shouldClearIdToken: boolean
  constructor(message: string, shouldClearIdToken: boolean) {
    super(message)
    this.name = 'XaaTokenExchangeError'
    this.shouldClearIdToken = shouldClearIdToken
  }
}

// Matches quoted values for known token-bearing keys regardless of nesting
// depth. Works on both parsed-then-stringified bodies AND raw text() error
// bodies from !res.ok paths — a misbehaving AS that echoes the request's
// subject_token/assertion/client_secret in a 4xx error envelope must not leak
// into debug logs.
const SENSITIVE_TOKEN_RE =
  /"(access_token|refresh_token|id_token|assertion|subject_token|client_secret)"\s*:\s*"[^"]*"/g

function redactTokens(raw: unknown): string {
  const s = typeof raw === 'string' ? raw : jsonStringify(raw)
  return s.replace(SENSITIVE_TOKEN_RE, (_, k) => `"${k}":"[REDACTED]"`)
}

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const TokenExchangeResponseSchema = lazySchema(() =>
  z.object({
    access_token: z.string().optional(),
    issued_token_type: z.string().optional(),
    // z.coerce tolerates IdPs that send expires_in as a string (common in
    // PHP-backed IdPs) — technically non-conformant JSON but widespread.
    expires_in: z.coerce.number().optional(),
    scope: z.string().optional(),
  }),
)

const JwtBearerResponseSchema = lazySchema(() =>
  z.object({
    access_token: z.string().min(1),
    // Many ASes omit token_type since Bearer is the only value anyone uses
    // (RFC 6750). Don't reject a valid access_token over a missing label.
    token_type: z.string().default('Bearer'),
    expires_in: z.coerce.number().optional(),
    scope: z.string().optional(),
    refresh_token: z.string().optional(),
  }),
)

// ─── Layer 2: Discovery ─────────────────────────────────────────────────────

export type ProtectedResourceMetadata = {
  resource: string
  authorization_servers: string[]
}

/**
 * RFC 9728 PRM discovery via SDK, plus RFC 9728 §3.3 resource-mismatch
 * validation (mix-up protection — TODO: upstream to SDK).
 */
export async function discoverProtectedResource(
  serverUrl: string,
  opts?: { fetchFn?: FetchLike },
): Promise<ProtectedResourceMetadata> {
  let prm
  try {
    prm = await discoverOAuthProtectedResourceMetadata(
      serverUrl,
      undefined,
      opts?.fetchFn ?? defaultFetch,
    )
  } catch (e) {
    throw new Error(
      `XAA: PRM discovery failed: ${e instanceof Error ? e.message : String(e)}`,
    )
  }
  if (!prm.resource || !prm.authorization_servers?.[0]) {
    throw new Error(
      'XAA: PRM discovery failed: PRM missing resource or authorization_servers',
    )
  }
  if (normalizeUrl(prm.resource) !== normalizeUrl(serverUrl)) {
    throw new Error(
      `XAA: PRM discovery failed: PRM resource mismatch: expected ${serverUrl}, got ${prm.resource}`,
    )
  }
  return {
    resource: prm.resource,
    authorization_servers: prm.authorization_servers,
  }
}

export type AuthorizationServerMetadata = {
  issuer: string
  token_endpoint: string
  grant_types_supported?: string[]
  token_endpoint_auth_methods_supported?: string[]
}

/**
 * AS metadata discovery via SDK (RFC 8414 + OIDC fallback), plus RFC 8414
 * §3.3 issuer-mismatch validation (mix-up protection — TODO: upstream to SDK).
 */
export async function discoverAuthorizationServer(
  asUrl: string,
  opts?: { fetchFn?: FetchLike },
): Promise<AuthorizationServerMetadata> {
  const meta = await discoverAuthorizationServerMetadata(asUrl, {
    fetchFn: opts?.fetchFn ?? defaultFetch,
  })
  if (!meta?.issuer || !meta.token_endpoint) {
    throw new Error(
      `XAA: AS metadata discovery failed: no valid metadata at ${asUrl}`,
    )
  }
  if (normalizeUrl(meta.issuer) !== normalizeUrl(asUrl)) {
    throw new Error(
      `XAA: AS metadata discovery failed: issuer mismatch: expected ${asUrl}, got ${meta.issuer}`,
    )
  }
  // RFC 8414 §3.3 / RFC 9728 §3 require HTTPS. A PRM-advertised http:// AS
  // that self-consistently reports an http:// issuer would pass the mismatch
  // check above, then we'd POST id_token + client_secret over plaintext.
  if (new URL(meta.token_endpoint).protocol !== 'https:') {
    throw new Error(
      `XAA: refusing non-HTTPS token endpoint: ${meta.token_endpoint}`,
    )
  }
  return {
    issuer: meta.issuer,
    token_endpoint: meta.token_endpoint,
    grant_types_supported: meta.grant_types_supported,
    token_endpoint_auth_methods_supported:
      meta.token_endpoint_auth_methods_supported,
  }
}

// ─── Layer 2: Exchange ──────────────────────────────────────────────────────

export type JwtAuthGrantResult = {
  /** The ID-JAG (Identity Assertion Authorization Grant) */
  jwtAuthGrant: string
  expiresIn?: number
  scope?: string
}

/**
 * RFC 8693 Token Exchange at the IdP: id_token → ID-JAG.
 * Validates `issued_token_type` is `urn:ietf:params:oauth:token-type:id-jag`.
 *
 * `clientSecret` is optional — sent via `client_secret_post` if present.
 * Some IdPs register the client as confidential even when they advertise
 * `token_endpoint_auth_method: "none"`.
 *
 * TODO(xaa-ga): consult `token_endpoint_auth_methods_supported` from IdP
 * OIDC metadata and support `client_secret_basic`, mirroring the AS-side
 * selection in `performCrossAppAccess`. All major IdPs accept POST today.
 */
export async function requestJwtAuthorizationGrant(opts: {
  tokenEndpoint: string
  audience: string
  resource: string
  idToken: string
  clientId: string
  clientSecret?: string
  scope?: string
  fetchFn?: FetchLike
}): Promise<JwtAuthGrantResult> {
  const fetchFn = opts.fetchFn ?? defaultFetch
  const params = new URLSearchParams({
    grant_type: TOKEN_EXCHANGE_GRANT,
    requested_token_type: ID_JAG_TOKEN_TYPE,
    audience: opts.audience,
    resource: opts.resource,
    subject_token: opts.idToken,
    subject_token_type: ID_TOKEN_TYPE,
    client_id: opts.clientId,
  })
  if (opts.clientSecret) {
    params.set('client_secret', opts.clientSecret)
  }
  if (opts.scope) {
    params.set('scope', opts.scope)
  }

  const res = await fetchFn(opts.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })
  if (!res.ok) {
    const body = redactTokens(await res.text()).slice(0, 200)
    // 4xx → id_token rejected (invalid_grant etc.), clear cache.
    // 5xx → IdP outage, id_token may still be valid, preserve it.
    const shouldClear = res.status < 500
    throw new XaaTokenExchangeError(
      `XAA: token exchange failed: HTTP ${res.status}: ${body}`,
      shouldClear,
    )
  }
  let rawExchange: unknown
  try {
    rawExchange = await res.json()
  } catch {
    // Transient network condition (captive portal, proxy) — don't clear id_token.
    throw new XaaTokenExchangeError(
      `XAA: token exchange returned non-JSON (captive portal?) at ${opts.tokenEndpoint}`,
      false,
    )
  }
  const exchangeParsed = TokenExchangeResponseSchema().safeParse(rawExchange)
  if (!exchangeParsed.success) {
    throw new XaaTokenExchangeError(
      `XAA: token exchange response did not match expected shape: ${redactTokens(rawExchange)}`,
      true,
    )
  }
  const result = exchangeParsed.data
  if (!result.access_token) {
    throw new XaaTokenExchangeError(
      `XAA: token exchange response missing access_token: ${redactTokens(result)}`,
      true,
    )
  }
  if (result.issued_token_type !== ID_JAG_TOKEN_TYPE) {
    throw new XaaTokenExchangeError(
      `XAA: token exchange returned unexpected issued_token_type: ${result.issued_token_type}`,
      true,
    )
  }
  return {
    jwtAuthGrant: result.access_token,
    expiresIn: result.expires_in,
    scope: result.scope,
  }
}

export type XaaTokenResult = {
  access_token: string
  token_type: string
  expires_in?: number
  scope?: string
  refresh_token?: string
}

export type XaaResult = XaaTokenResult & {
  /**
   * The AS issuer URL discovered via PRM. Callers must persist this as
   * `discoveryState.authorizationServerUrl` so that refresh (auth.ts _doRefresh)
   * and revocation (revokeServerTokens) can locate the token/revocation
   * endpoints — the MCP URL is not the AS URL in typical XAA setups.
   */
  authorizationServerUrl: string
}

/**
 * RFC 7523 JWT Bearer Grant at the AS: ID-JAG → access_token.
 *
 * `authMethod` defaults to `client_secret_basic` (Base64 header, not body
 * params) — the SEP-990 conformance test requires this. Only set
 * `client_secret_post` if the AS explicitly requires it.
 */
export async function exchangeJwtAuthGrant(opts: {
  tokenEndpoint: string
  assertion: string
  clientId: string
  clientSecret: string
  authMethod?: 'client_secret_basic' | 'client_secret_post'
  scope?: string
  fetchFn?: FetchLike
}): Promise<XaaTokenResult> {
  const fetchFn = opts.fetchFn ?? defaultFetch
  const authMethod = opts.authMethod ?? 'client_secret_basic'

  const params = new URLSearchParams({
    grant_type: JWT_BEARER_GRANT,
    assertion: opts.assertion,
  })
  if (opts.scope) {
    params.set('scope', opts.scope)
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  }
  if (authMethod === 'client_secret_basic') {
    const basicAuth = Buffer.from(
      `${encodeURIComponent(opts.clientId)}:${encodeURIComponent(opts.clientSecret)}`,
    ).toString('base64')
    headers.Authorization = `Basic ${basicAuth}`
  } else {
    params.set('client_id', opts.clientId)
    params.set('client_secret', opts.clientSecret)
  }

  const res = await fetchFn(opts.tokenEndpoint, {
    method: 'POST',
    headers,
    body: params,
  })
  if (!res.ok) {
    const body = redactTokens(await res.text()).slice(0, 200)
    throw new Error(`XAA: jwt-bearer grant failed: HTTP ${res.status}: ${body}`)
  }
  let rawTokens: unknown
  try {
    rawTokens = await res.json()
  } catch {
    throw new Error(
      `XAA: jwt-bearer grant returned non-JSON (captive portal?) at ${opts.tokenEndpoint}`,
    )
  }
  const tokensParsed = JwtBearerResponseSchema().safeParse(rawTokens)
  if (!tokensParsed.success) {
    throw new Error(
      `XAA: jwt-bearer response did not match expected shape: ${redactTokens(rawTokens)}`,
    )
  }
  return tokensParsed.data
}

// ─── Layer 3: Orchestrator ──────────────────────────────────────────────────

/**
 * Config needed to run the full XAA orchestrator.
 * Mirrors the conformance test context shape (see ClientConformanceContextSchema).
 */
export type XaaConfig = {
  /** Client ID registered at the MCP server's authorization server */
  clientId: string
  /** Client secret for the MCP server's authorization server */
  clientSecret: string
  /** Client ID registered at the IdP (for the token-exchange request) */
  idpClientId: string
  /** Optional IdP client secret (client_secret_post) — some IdPs require it */
  idpClientSecret?: string
  /** The user's OIDC id_token from the IdP login */
  idpIdToken: string
  /** IdP token endpoint (where to send the RFC 8693 token-exchange) */
  idpTokenEndpoint: string
}

/**
 * Full XAA flow: PRM → AS metadata → token-exchange → jwt-bearer → access_token.
 * Thin composition of the four Layer-2 ops. Used by performMCPXaaAuth,
 * ClaudeAuthProvider.xaaRefresh, and the try-xaa*.ts debug scripts.
 *
 * @param serverUrl The MCP server URL (e.g. `https://mcp.example.com/mcp`)
 * @param config IdP + AS credentials
 * @param serverName Server name for debug logging
 */
export async function performCrossAppAccess(
  serverUrl: string,
  config: XaaConfig,
  serverName = 'xaa',
  abortSignal?: AbortSignal,
): Promise<XaaResult> {
  const fetchFn = makeXaaFetch(abortSignal)

  logMCPDebug(serverName, `XAA: discovering PRM for ${serverUrl}`)
  const prm = await discoverProtectedResource(serverUrl, { fetchFn })
  logMCPDebug(
    serverName,
    `XAA: discovered resource=${prm.resource} ASes=[${prm.authorization_servers.join(', ')}]`,
  )

  // Try each advertised AS in order. grant_types_supported is OPTIONAL per
  // RFC 8414 §2 — only skip if the AS explicitly advertises a list that omits
  // jwt-bearer. If absent, let the token endpoint decide.
  let asMeta: AuthorizationServerMetadata | undefined
  const asErrors: string[] = []
  for (const asUrl of prm.authorization_servers) {
    let candidate: AuthorizationServerMetadata
    try {
      candidate = await discoverAuthorizationServer(asUrl, { fetchFn })
    } catch (e) {
      if (abortSignal?.aborted) throw e
      asErrors.push(`${asUrl}: ${e instanceof Error ? e.message : String(e)}`)
      continue
    }
    if (
      candidate.grant_types_supported &&
      !candidate.grant_types_supported.includes(JWT_BEARER_GRANT)
    ) {
      asErrors.push(
        `${asUrl}: does not advertise jwt-bearer grant (supported: ${candidate.grant_types_supported.join(', ')})`,
      )
      continue
    }
    asMeta = candidate
    break
  }
  if (!asMeta) {
    throw new Error(
      `XAA: no authorization server supports jwt-bearer. Tried: ${asErrors.join('; ')}`,
    )
  }
  // Pick auth method from what the AS advertises. We handle
  // client_secret_basic and client_secret_post; if the AS only supports post,
  // honor that, else default to basic (SEP-990 conformance expectation).
  const authMethods = asMeta.token_endpoint_auth_methods_supported
  const authMethod: 'client_secret_basic' | 'client_secret_post' =
    authMethods &&
    !authMethods.includes('client_secret_basic') &&
    authMethods.includes('client_secret_post')
      ? 'client_secret_post'
      : 'client_secret_basic'
  logMCPDebug(
    serverName,
    `XAA: AS issuer=${asMeta.issuer} token_endpoint=${asMeta.token_endpoint} auth_method=${authMethod}`,
  )

  logMCPDebug(serverName, `XAA: exchanging id_token for ID-JAG at IdP`)
  const jag = await requestJwtAuthorizationGrant({
    tokenEndpoint: config.idpTokenEndpoint,
    audience: asMeta.issuer,
    resource: prm.resource,
    idToken: config.idpIdToken,
    clientId: config.idpClientId,
    clientSecret: config.idpClientSecret,
    fetchFn,
  })
  logMCPDebug(serverName, `XAA: ID-JAG obtained`)

  logMCPDebug(serverName, `XAA: exchanging ID-JAG for access_token at AS`)
  const tokens = await exchangeJwtAuthGrant({
    tokenEndpoint: asMeta.token_endpoint,
    assertion: jag.jwtAuthGrant,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authMethod,
    fetchFn,
  })
  logMCPDebug(serverName, `XAA: access_token obtained`)

  return { ...tokens, authorizationServerUrl: asMeta.issuer }
}
