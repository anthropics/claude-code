import axios from 'axios'
import { getOauthConfig } from '../../constants/oauth.js'
import { logForDebugging } from '../../utils/debug.js'
import { getOAuthHeaders, prepareApiRequest } from '../../utils/teleport/api.js'
import { fetchEnvironments } from '../../utils/teleport/environments.js'

const CCR_BYOC_BETA_HEADER = 'ccr-byoc-2025-07-29'

/**
 * Wraps a raw GitHub token so that its string representation is redacted.
 * `String(token)`, template literals, `JSON.stringify(token)`, and any
 * attached error messages will show `[REDACTED:gh-token]` instead of the
 * token value. Call `.reveal()` only at the single point where the raw
 * value is placed into an HTTP body.
 */
export class RedactedGithubToken {
  readonly #value: string
  constructor(raw: string) {
    this.#value = raw
  }
  reveal(): string {
    return this.#value
  }
  toString(): string {
    return '[REDACTED:gh-token]'
  }
  toJSON(): string {
    return '[REDACTED:gh-token]'
  }
  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return '[REDACTED:gh-token]'
  }
}

export type ImportTokenResult = {
  github_username: string
}

export type ImportTokenError =
  | { kind: 'not_signed_in' }
  | { kind: 'invalid_token' }
  | { kind: 'server'; status: number }
  | { kind: 'network' }

/**
 * POSTs a GitHub token to the CCR backend, which validates it against
 * GitHub's /user endpoint and stores it Fernet-encrypted in sync_user_tokens.
 * The stored token satisfies the same read paths as an OAuth token, so
 * clone/push in claude.ai/code works immediately after this succeeds.
 */
export async function importGithubToken(
  token: RedactedGithubToken,
): Promise<
  | { ok: true; result: ImportTokenResult }
  | { ok: false; error: ImportTokenError }
> {
  let accessToken: string, orgUUID: string
  try {
    ;({ accessToken, orgUUID } = await prepareApiRequest())
  } catch {
    return { ok: false, error: { kind: 'not_signed_in' } }
  }

  const url = `${getOauthConfig().BASE_API_URL}/v1/code/github/import-token`
  const headers = {
    ...getOAuthHeaders(accessToken),
    'anthropic-beta': CCR_BYOC_BETA_HEADER,
    'x-organization-uuid': orgUUID,
  }

  try {
    const response = await axios.post<ImportTokenResult>(
      url,
      { token: token.reveal() },
      { headers, timeout: 15000, validateStatus: () => true },
    )
    if (response.status === 200) {
      return { ok: true, result: response.data }
    }
    if (response.status === 400) {
      return { ok: false, error: { kind: 'invalid_token' } }
    }
    if (response.status === 401) {
      return { ok: false, error: { kind: 'not_signed_in' } }
    }
    logForDebugging(`import-token returned ${response.status}`, {
      level: 'error',
    })
    return { ok: false, error: { kind: 'server', status: response.status } }
  } catch (err) {
    if (axios.isAxiosError(err)) {
      // err.config.data would contain the POST body with the raw token.
      // Do not include it in any log. The error code alone is enough.
      logForDebugging(`import-token network error: ${err.code ?? 'unknown'}`, {
        level: 'error',
      })
    }
    return { ok: false, error: { kind: 'network' } }
  }
}

async function hasExistingEnvironment(): Promise<boolean> {
  try {
    const envs = await fetchEnvironments()
    return envs.length > 0
  } catch {
    return false
  }
}

/**
 * Best-effort default environment creation. Mirrors the web onboarding's
 * DEFAULT_CLOUD_ENVIRONMENT_REQUEST so a first-time user lands on the
 * composer instead of env-setup. Checks for existing environments first
 * so re-running /web-setup doesn't pile up duplicates. Failures are
 * non-fatal — the token import already succeeded, and the web state
 * machine falls back to env-setup on next load.
 */
export async function createDefaultEnvironment(): Promise<boolean> {
  let accessToken: string, orgUUID: string
  try {
    ;({ accessToken, orgUUID } = await prepareApiRequest())
  } catch {
    return false
  }

  if (await hasExistingEnvironment()) {
    return true
  }

  // The /private/organizations/{org}/ path rejects CLI OAuth tokens (wrong
  // auth dep). The public path uses build_flexible_auth — same path
  // fetchEnvironments() uses. Org is passed via x-organization-uuid header.
  const url = `${getOauthConfig().BASE_API_URL}/v1/environment_providers/cloud/create`
  const headers = {
    ...getOAuthHeaders(accessToken),
    'x-organization-uuid': orgUUID,
  }

  try {
    const response = await axios.post(
      url,
      {
        name: 'Default',
        kind: 'anthropic_cloud',
        description: 'Default - trusted network access',
        config: {
          environment_type: 'anthropic',
          cwd: '/home/user',
          init_script: null,
          environment: {},
          languages: [
            { name: 'python', version: '3.11' },
            { name: 'node', version: '20' },
          ],
          network_config: {
            allowed_hosts: [],
            allow_default_hosts: true,
          },
        },
      },
      { headers, timeout: 15000, validateStatus: () => true },
    )
    return response.status >= 200 && response.status < 300
  } catch {
    return false
  }
}

/** Returns true when the user has valid Claude OAuth credentials. */
export async function isSignedIn(): Promise<boolean> {
  try {
    await prepareApiRequest()
    return true
  } catch {
    return false
  }
}

export function getCodeWebUrl(): string {
  return `${getOauthConfig().CLAUDE_AI_ORIGIN}/code`
}
