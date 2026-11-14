/**
 * XAA IdP Login — acquires an OIDC id_token from an enterprise IdP via the
 * standard authorization_code + PKCE flow, then caches it by IdP issuer.
 *
 * This is the "one browser pop" in the XAA value prop: one IdP login → N silent
 * MCP server auths. The id_token is cached in the keychain and reused until expiry.
 */

import {
  exchangeAuthorization,
  startAuthorization,
} from '@modelcontextprotocol/sdk/client/auth.js'
import {
  type OAuthClientInformation,
  type OpenIdProviderDiscoveryMetadata,
  OpenIdProviderDiscoveryMetadataSchema,
} from '@modelcontextprotocol/sdk/shared/auth.js'
import { randomBytes } from 'crypto'
import { createServer, type Server } from 'http'
import { parse } from 'url'
import xss from 'xss'
import { openBrowser } from '../../utils/browser.js'
import { isEnvTruthy } from '../../utils/envUtils.js'
import { toError } from '../../utils/errors.js'
import { logMCPDebug } from '../../utils/log.js'
import { getPlatform } from '../../utils/platform.js'
import { getSecureStorage } from '../../utils/secureStorage/index.js'
import { getInitialSettings } from '../../utils/settings/settings.js'
import { jsonParse } from '../../utils/slowOperations.js'
import { buildRedirectUri, findAvailablePort } from './oauthPort.js'

export function isXaaEnabled(): boolean {
  return isEnvTruthy(process.env.CLAUDE_CODE_ENABLE_XAA)
}

export type XaaIdpSettings = {
  issuer: string
  clientId: string
  callbackPort?: number
}

/**
 * Typed accessor for settings.xaaIdp. The field is env-gated in SettingsSchema
 * so it doesn't surface in SDK types/docs — which means the inferred settings
 * type doesn't have it at compile time. This is the one cast.
 */
export function getXaaIdpSettings(): XaaIdpSettings | undefined {
  return (getInitialSettings() as { xaaIdp?: XaaIdpSettings }).xaaIdp
}

const IDP_LOGIN_TIMEOUT_MS = 5 * 60 * 1000
const IDP_REQUEST_TIMEOUT_MS = 30000
const ID_TOKEN_EXPIRY_BUFFER_S = 60

export type IdpLoginOptions = {
  idpIssuer: string
  idpClientId: string
  /**
   * Optional IdP client secret for confidential clients. Auth method
   * (client_secret_post, client_secret_basic, none) is chosen per IdP
   * metadata. Omit for public clients (PKCE only).
   */
  idpClientSecret?: string
  /**
   * Fixed callback port. If omitted, a random port is chosen.
   * Use this when the IdP client is pre-registered with a specific loopback
   * redirect URI (RFC 8252 §7.3 says IdPs SHOULD accept any port for
   * http://localhost, but many don't).
   */
  callbackPort?: number
  /** Called with the authorization URL before (or instead of) opening the browser */
  onAuthorizationUrl?: (url: string) => void
  /** If true, don't auto-open the browser — just call onAuthorizationUrl */
  skipBrowserOpen?: boolean
  abortSignal?: AbortSignal
}

/**
 * Normalize an IdP issuer URL for use as a cache key: strip trailing slashes,
 * lowercase host. Issuers from config and from OIDC discovery may differ
 * cosmetically but should hit the same cache slot. Exported so the setup
 * command can compare issuers using the same normalization as keychain ops.
 */
export function issuerKey(issuer: string): string {
  try {
    const u = new URL(issuer)
    u.pathname = u.pathname.replace(/\/+$/, '')
    u.host = u.host.toLowerCase()
    return u.toString()
  } catch {
    return issuer.replace(/\/+$/, '')
  }
}

/**
 * Read a cached id_token for the given IdP issuer from secure storage.
 * Returns undefined if missing or within ID_TOKEN_EXPIRY_BUFFER_S of expiring.
 */
export function getCachedIdpIdToken(idpIssuer: string): string | undefined {
  const storage = getSecureStorage()
  const data = storage.read()
  const entry = data?.mcpXaaIdp?.[issuerKey(idpIssuer)]
  if (!entry) return undefined
  const remainingMs = entry.expiresAt - Date.now()
  if (remainingMs <= ID_TOKEN_EXPIRY_BUFFER_S * 1000) return undefined
  return entry.idToken
}

function saveIdpIdToken(
  idpIssuer: string,
  idToken: string,
  expiresAt: number,
): void {
  const storage = getSecureStorage()
  const existing = storage.read() || {}
  storage.update({
    ...existing,
    mcpXaaIdp: {
      ...existing.mcpXaaIdp,
      [issuerKey(idpIssuer)]: { idToken, expiresAt },
    },
  })
}

/**
 * Save an externally-obtained id_token into the XAA cache — the exact slot
 * getCachedIdpIdToken/acquireIdpIdToken read from. Used by conformance testing
 * where the mock IdP hands us a pre-signed token but doesn't serve /authorize.
 *
 * Parses the JWT's exp claim for cache TTL (same as acquireIdpIdToken).
 * Returns the expiresAt it computed so the caller can report it.
 */
export function saveIdpIdTokenFromJwt(
  idpIssuer: string,
  idToken: string,
): number {
  const expFromJwt = jwtExp(idToken)
  const expiresAt = expFromJwt ? expFromJwt * 1000 : Date.now() + 3600 * 1000
  saveIdpIdToken(idpIssuer, idToken, expiresAt)
  return expiresAt
}

export function clearIdpIdToken(idpIssuer: string): void {
  const storage = getSecureStorage()
  const existing = storage.read()
  const key = issuerKey(idpIssuer)
  if (!existing?.mcpXaaIdp?.[key]) return
  delete existing.mcpXaaIdp[key]
  storage.update(existing)
}

/**
 * Save an IdP client secret to secure storage, keyed by IdP issuer.
 * Separate from MCP server AS secrets — different trust domain.
 * Returns the storage update result so callers can surface keychain
 * failures (locked keychain, `security` nonzero exit) instead of
 * silently dropping the secret and failing later with invalid_client.
 */
export function saveIdpClientSecret(
  idpIssuer: string,
  clientSecret: string,
): { success: boolean; warning?: string } {
  const storage = getSecureStorage()
  const existing = storage.read() || {}
  return storage.update({
    ...existing,
    mcpXaaIdpConfig: {
      ...existing.mcpXaaIdpConfig,
      [issuerKey(idpIssuer)]: { clientSecret },
    },
  })
}

/**
 * Read the IdP client secret for the given issuer from secure storage.
 */
export function getIdpClientSecret(idpIssuer: string): string | undefined {
  const storage = getSecureStorage()
  const data = storage.read()
  return data?.mcpXaaIdpConfig?.[issuerKey(idpIssuer)]?.clientSecret
}

/**
 * Remove the IdP client secret for the given issuer from secure storage.
 * Used by `claude mcp xaa clear`.
 */
export function clearIdpClientSecret(idpIssuer: string): void {
  const storage = getSecureStorage()
  const existing = storage.read()
  const key = issuerKey(idpIssuer)
  if (!existing?.mcpXaaIdpConfig?.[key]) return
  delete existing.mcpXaaIdpConfig[key]
  storage.update(existing)
}

// OIDC Discovery §4.1 says `{issuer}/.well-known/openid-configuration` — path
// APPEND, not replace. `new URL('/.well-known/...', issuer)` with a leading
// slash is a WHATWG absolute-path reference and drops the issuer's pathname,
// breaking Azure AD (`login.microsoftonline.com/{tenant}/v2.0`), Okta custom
// auth servers, and Keycloak realms. Trailing-slash base + relative path is
// the fix. Exported because auth.ts needs the same discovery.
export async function discoverOidc(
  idpIssuer: string,
): Promise<OpenIdProviderDiscoveryMetadata> {
  const base = idpIssuer.endsWith('/') ? idpIssuer : idpIssuer + '/'
  const url = new URL('.well-known/openid-configuration', base)
  // eslint-disable-next-line eslint-plugin-n/no-unsupported-features/node-builtins
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(IDP_REQUEST_TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new Error(
      `XAA IdP: OIDC discovery failed: HTTP ${res.status} at ${url}`,
    )
  }
  // Captive portals and proxy auth pages return 200 with HTML. res.json()
  // throws a raw SyntaxError before safeParse can give a useful message.
  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new Error(
      `XAA IdP: OIDC discovery returned non-JSON at ${url} (captive portal or proxy?)`,
    )
  }
  const parsed = OpenIdProviderDiscoveryMetadataSchema.safeParse(body)
  if (!parsed.success) {
    throw new Error(`XAA IdP: invalid OIDC metadata: ${parsed.error.message}`)
  }
  if (new URL(parsed.data.token_endpoint).protocol !== 'https:') {
    throw new Error(
      `XAA IdP: refusing non-HTTPS token endpoint: ${parsed.data.token_endpoint}`,
    )
  }
  return parsed.data
}

/**
 * Decode the exp claim from a JWT without verifying its signature.
 * Returns undefined if parsing fails or exp is absent. Used only to
 * derive a cache TTL.
 *
 * Why no signature/iss/aud/nonce validation: per SEP-990, this id_token
 * is the RFC 8693 subject_token in a token-exchange at the IdP's own
 * token endpoint. The IdP validates its own token there. An attacker who
 * can mint a token that fools the IdP has no need to fool us first; an
 * attacker who can't, hands us garbage and gets a 401 from the IdP. The
 * --id-token injection seam is likewise safe: bad input → rejected later,
 * no privesc. Client-side verification would add code and no security.
 */
function jwtExp(jwt: string): number | undefined {
  const parts = jwt.split('.')
  if (parts.length !== 3) return undefined
  try {
    const payload = jsonParse(
      Buffer.from(parts[1]!, 'base64url').toString('utf-8'),
    ) as { exp?: number }
    return typeof payload.exp === 'number' ? payload.exp : undefined
  } catch {
    return undefined
  }
}

/**
 * Wait for the OAuth authorization code on a local callback server.
 * Returns the code once /callback is hit with a matching state.
 *
 * `onListening` fires after the socket is actually bound — use it to defer
 * browser-open so EADDRINUSE surfaces before a spurious tab pops open.
 */
function waitForCallback(
  port: number,
  expectedState: string,
  abortSignal: AbortSignal | undefined,
  onListening: () => void,
): Promise<string> {
  let server: Server | null = null
  let timeoutId: NodeJS.Timeout | null = null
  let abortHandler: (() => void) | null = null
  const cleanup = () => {
    server?.removeAllListeners()
    // Defensive: removeAllListeners() strips the error handler, so swallow any late error during close
    server?.on('error', () => {})
    server?.close()
    server = null
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    if (abortSignal && abortHandler) {
      abortSignal.removeEventListener('abort', abortHandler)
      abortHandler = null
    }
  }
  return new Promise<string>((resolve, reject) => {
    let resolved = false
    const resolveOnce = (v: string) => {
      if (resolved) return
      resolved = true
      cleanup()
      resolve(v)
    }
    const rejectOnce = (e: Error) => {
      if (resolved) return
      resolved = true
      cleanup()
      reject(e)
    }

    if (abortSignal) {
      abortHandler = () => rejectOnce(new Error('XAA IdP: login cancelled'))
      if (abortSignal.aborted) {
        abortHandler()
        return
      }
      abortSignal.addEventListener('abort', abortHandler, { once: true })
    }

    server = createServer((req, res) => {
      const parsed = parse(req.url || '', true)
      if (parsed.pathname !== '/callback') {
        res.writeHead(404)
        res.end()
        return
      }
      const code = parsed.query.code as string | undefined
      const state = parsed.query.state as string | undefined
      const err = parsed.query.error as string | undefined

      if (err) {
        const desc = parsed.query.error_description as string | undefined
        const safeErr = xss(err)
        const safeDesc = desc ? xss(desc) : ''
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end(
          `<html><body><h3>IdP login failed</h3><p>${safeErr}</p><p>${safeDesc}</p></body></html>`,
        )
        rejectOnce(new Error(`XAA IdP: ${err}${desc ? ` — ${desc}` : ''}`))
        return
      }

      if (state !== expectedState) {
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end('<html><body><h3>State mismatch</h3></body></html>')
        rejectOnce(new Error('XAA IdP: state mismatch (possible CSRF)'))
        return
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end('<html><body><h3>Missing code</h3></body></html>')
        rejectOnce(new Error('XAA IdP: callback missing code'))
        return
      }

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(
        '<html><body><h3>IdP login complete — you can close this window.</h3></body></html>',
      )
      resolveOnce(code)
    })

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        const findCmd =
          getPlatform() === 'windows'
            ? `netstat -ano | findstr :${port}`
            : `lsof -ti:${port} -sTCP:LISTEN`
        rejectOnce(
          new Error(
            `XAA IdP: callback port ${port} is already in use. Run \`${findCmd}\` to find the holder.`,
          ),
        )
      } else {
        rejectOnce(new Error(`XAA IdP: callback server failed: ${err.message}`))
      }
    })

    server.listen(port, '127.0.0.1', () => {
      try {
        onListening()
      } catch (e) {
        rejectOnce(toError(e))
      }
    })
    server.unref()
    timeoutId = setTimeout(
      rej => rej(new Error('XAA IdP: login timed out')),
      IDP_LOGIN_TIMEOUT_MS,
      rejectOnce,
    )
    timeoutId.unref()
  })
}

/**
 * Acquire an id_token from the IdP: return cached if valid, otherwise run
 * the full OIDC authorization_code + PKCE flow (one browser pop).
 */
export async function acquireIdpIdToken(
  opts: IdpLoginOptions,
): Promise<string> {
  const { idpIssuer, idpClientId } = opts

  const cached = getCachedIdpIdToken(idpIssuer)
  if (cached) {
    logMCPDebug('xaa', `Using cached id_token for ${idpIssuer}`)
    return cached
  }

  logMCPDebug('xaa', `No cached id_token for ${idpIssuer}; starting OIDC login`)

  const metadata = await discoverOidc(idpIssuer)
  const port = opts.callbackPort ?? (await findAvailablePort())
  const redirectUri = buildRedirectUri(port)
  const state = randomBytes(32).toString('base64url')
  const clientInformation: OAuthClientInformation = {
    client_id: idpClientId,
    ...(opts.idpClientSecret ? { client_secret: opts.idpClientSecret } : {}),
  }

  const { authorizationUrl, codeVerifier } = await startAuthorization(
    idpIssuer,
    {
      metadata,
      clientInformation,
      redirectUrl: redirectUri,
      scope: 'openid',
      state,
    },
  )

  // Open the browser only after the socket is actually bound — listen() is
  // async, and on the fixed-callbackPort path EADDRINUSE otherwise surfaces
  // after a spurious tab has already popped. Mirrors the auth.ts pattern of
  // wrapping sdkAuth inside server.listen's callback.
  const authorizationCode = await waitForCallback(
    port,
    state,
    opts.abortSignal,
    () => {
      if (opts.onAuthorizationUrl) {
        opts.onAuthorizationUrl(authorizationUrl.toString())
      }
      if (!opts.skipBrowserOpen) {
        logMCPDebug('xaa', `Opening browser to IdP authorization endpoint`)
        void openBrowser(authorizationUrl.toString())
      }
    },
  )

  const tokens = await exchangeAuthorization(idpIssuer, {
    metadata,
    clientInformation,
    authorizationCode,
    codeVerifier,
    redirectUri,
    fetchFn: (url, init) =>
      // eslint-disable-next-line eslint-plugin-n/no-unsupported-features/node-builtins
      fetch(url, {
        ...init,
        signal: AbortSignal.timeout(IDP_REQUEST_TIMEOUT_MS),
      }),
  })
  if (!tokens.id_token) {
    throw new Error(
      'XAA IdP: token response missing id_token (check scope=openid)',
    )
  }

  // Prefer the id_token's own exp claim; fall back to expires_in.
  // expires_in is for the access_token and may differ from the id_token
  // lifetime. If neither is present, default to 1h.
  const expFromJwt = jwtExp(tokens.id_token)
  const expiresAt = expFromJwt
    ? expFromJwt * 1000
    : Date.now() + (tokens.expires_in ?? 3600) * 1000

  saveIdpIdToken(idpIssuer, tokens.id_token, expiresAt)
  logMCPDebug(
    'xaa',
    `Cached id_token for ${idpIssuer} (expires ${new Date(expiresAt).toISOString()})`,
  )

  return tokens.id_token
}
