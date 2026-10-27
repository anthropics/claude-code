import { hexOf } from './hex-of'
import { normalizedRemoteOf } from './normalized-remote-of'
import { REMOTE_HASH_LENGTH } from './remote-hash-length'

/**
 * The rows' `rh`: the first hex digits of the SHA-256 of the session's
 * normalized origin remote, the key the CLI's own rows join a repository by.
 *
 * @param remote the origin remote as `$.session.repo()` answers it
 * @returns the hash, or undefined outside a recognized remote
 */
export async function remoteHashOf(
  remote: string | null | undefined,
): Promise<string | undefined> {
  const normalized = remote ? normalizedRemoteOf(remote) : undefined

  if (normalized === undefined) {
    return undefined
  }

  return hexOf(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized)),
  ).slice(0, REMOTE_HASH_LENGTH)
}
